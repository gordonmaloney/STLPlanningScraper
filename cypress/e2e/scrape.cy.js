/// <reference types="cypress" />

// ─── Prevent Cypress from failing on uncaught exceptions in the application under test ───
Cypress.on("uncaught:exception", (err, runnable) => {
  // return false to prevent Cypress from
  // failing the test due to errors in the application
  return false;
});

//Edinburgh
const URL_BASE = "https://citydev-portal.edinburgh.gov.uk";
const SEARCH_URL = `${URL_BASE}/idoxpa-web/search.do?action=advanced`;
const SEARCH_PHRASE = "short term let";
const APPLICATIONS_FILE = `${Cypress.config(
  "fileServerFolder"
)}/data/applications.json`;
let newApplications = [];

//Highlands
const HL_URL_BASE = "https://wam.highland.gov.uk";
const HL_SEARCH_URL = `${HL_URL_BASE}/wam/search.do?action=advanced`;
const HL_SEARCH_PHRASE = "short term let";
const HL_APPLICATIONS_FILE = `${Cypress.config(
  "fileServerFolder"
)}/data/HL_applications.json`;
let newHLApplications = [];

const getDaysAgo = (days) => {
  const date = new Date();
  date.setDate(date.getDate() - days);
  return date;
};

const START_DATE = getDaysAgo(120);

const getPostcode = (string) => {
  const match = string.match(/[a-z0-9]{3,4}\s[a-z0-9]{3,4}$/i);
  return match ? match[0] : "";
};


describe("Searches Edinburgh council planning site", () => {
  it("Finds new applications", () => {
    cy.visit(SEARCH_URL, {
      // if the page returns 4xx/5xx, don’t fail here
      failOnStatusCode: false,
    });

    cy.get("#description").type(SEARCH_PHRASE);
    cy.get("#caseStatus").select("Awaiting Assessment");
    cy.get("#applicationReceivedStart").type(
      [
        START_DATE.getDate(),
        START_DATE.getMonth() + 1, // month is 0‑based
        START_DATE.getFullYear(),
      ].join("/")
    );

    cy.get('input[type="submit"]').contains("Search").click();

    cy.get(".content")
      .then(($el) => $el.find("#resultsPerPage").length)
      .then((hasResults) => {
        if (!hasResults) return;

        cy.get("#resultsPerPage").select("100");
        cy.get('input[type="submit"]').contains("Go").click();

        cy.get("#searchresults li").each(($li) => {
          const $link = $li.find("a");
          const [refNo, received, validated, status] = $li
            .find(".metaInfo")
            .text()
            .trim()
            .replace(/\n/g, "")
            .replace(/\s+/g, " ")
            .split(" | ");
          const address = $li.find(".address").text().trim();

          newApplications.push({
            link: `${URL_BASE}${$link.attr("href")}`,
            proposal: $link.text().trim(),
            address,
            postcode: getPostcode(address),
            refNo,
            received,
            validated,
            status,
          });
        });
      });
  });

  it("Saves new applications", () => {
    // even if newApplications is empty, we write an empty array
    cy.writeFile(APPLICATIONS_FILE, JSON.stringify(newApplications, null, 2));
  });
});


describe("Searches Highland council planning site", () => {
  it("Finds new applications", () => {
    cy.log("**Starting Highland search**");
    cy.visit(HL_SEARCH_URL, { failOnStatusCode: false });

    // Cookie banner (only click if present)
    cy.get('button:contains("I Accept")', { timeout: 2000 }).then(($btn) => {
      if ($btn.length) cy.wrap($btn).click({ force: true });
    });

    // Fill the form
    cy.get("#description")
      .scrollIntoView()
      .should("be.visible")
      .type(HL_SEARCH_PHRASE);
    cy.get("#caseStatus")
      .scrollIntoView()
      .should("be.visible")
      .select("Under Consideration");
    cy.get("#applicationReceivedStart")
      .scrollIntoView()
      .should("be.visible")
      .type(
        [
          START_DATE.getDate(),
          START_DATE.getMonth() + 1,
          START_DATE.getFullYear(),
        ].join("/")
      );

    // Click the *correct* Search (scoped to the form that owns #description)
    cy.get("#description")
      .closest("form")
      .within(() => {
        cy.contains('input[type="submit"]', "Search").click();
      });

    // Sanity check: still on the planning portal domain
    cy.url().should("include", HL_URL_BASE);

    // Detect results page
    cy.get(".content")
      .then(($el) => {
        const hasResults = $el.find("#resultsPerPage").length > 0;
        cy.log(`Has results page selector: ${hasResults}`);
        return cy.wrap(hasResults, { log: false });
      })
      .then((hasResults) => {
        if (!hasResults) {
          cy.log("**No results found**");
          return;
        }

        cy.log("**Results found, setting to 100 per page**");
        // Change results/page and click the *correct* Go (scoped to the select’s form)
        cy.get("#resultsPerPage")
          .scrollIntoView()
          .select("100")
          .closest("form")
          .within(() => {
            cy.contains('input[type="submit"]', "Go").click();
          });

        cy.url().should("include", HL_URL_BASE);

        cy.get("#searchresults li").each(($li, index) => {
          cy.log(`Processing application ${index + 1}`);

          const $link = $li.find("a");
          const [refNo, received, validated, status] = $li
            .find(".metaInfo")
            .text()
            .trim()
            .replace(/\n/g, "")
            .replace(/\s+/g, " ")
            .split(" | ");
          const address = $li.find(".address").text().trim();

          const application = {
            link: `${HL_URL_BASE}${$link.attr("href")}`,
            proposal: $link.text().trim(),
            address,
            postcode: getPostcode(address),
            refNo,
            received,
            validated,
            status,
          };

          cy.log(`Application: ${refNo} - ${address}`);
          if (application.postcode) {
            newHLApplications.push(application);
          }
        });
      });
  });

  it("Saves new applications", () => {
    cy.log(`**Saving ${newHLApplications.length} application(s)**`);
    cy.writeFile(
      HL_APPLICATIONS_FILE,
      JSON.stringify(newHLApplications, null, 2)
    );
  });
});
