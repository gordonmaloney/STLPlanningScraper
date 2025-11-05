/// <reference types="cypress" />

// ─── Prevent Cypress from failing on uncaught exceptions in the application under test ───
Cypress.on("uncaught:exception", (err, runnable) => {
  // return false to prevent Cypress from
  // failing the test due to errors in the application
  return false;
});

const snap = (name) => {
  // queues a screenshot with consistent naming
  cy.screenshot(name, { capture: "fullPage" });
};

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

//CnE
const CnE_URL_BASE = "https://planning.cne-siar.gov.uk";
const CnE_SEARCH_URL = `${CnE_URL_BASE}/PublicAccess/search.do?action=advanced`;
const CnE_APPLICATIONS_FILE = `${Cypress.config(
  "fileServerFolder"
)}/data/CnE_applications.json`;
let newCnEApplications = [];

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

const CnE_SEARCH_PHRASES = ["let"];

describe("Searches CnE council planning site", () => {
  CnE_SEARCH_PHRASES.forEach((phrase) => {
    it(`Finds new applications for '${phrase}'`, () => {
      const tag = phrase.replace(/\W+/g, "_").toLowerCase();

      cy.log(`**Starting CnE search for '${phrase}'**`);
      cy.visit(CnE_SEARCH_URL, { failOnStatusCode: false });

      // Fill the form
      cy.get("#reference")
        .scrollIntoView()
        .should("be.visible")
        .clear()
        .type("PPD");
      cy.get("#description")
        .scrollIntoView()
        .should("be.visible")
        .clear()
        .type(phrase);
      cy.get("#caseStatus")
        .scrollIntoView()
        .should("be.visible")
        .select("Awaiting decision");

      // Network intercept to ensure we wait for results load
      cy.intercept("**/PublicAccess/advancedSearchResults.do**").as("search");

      // Submit
      cy.get("#description")
        .closest("form")
        .within(() => {
          cy.contains('input[type="submit"]', "Search").click();
        });

      cy.wait("@search", { timeout: 30000 });
      cy.document().its("readyState").should("eq", "complete");

      // Persist the whole HTML after submit (handy if the DOM changes later)
      cy.get("body").then(($b) => {
        cy.writeFile(`cypress/artifacts/cne-results-${tag}.html`, $b.html());
      });

      // Check results
      cy.get(".content")
        .then(($el) => {
          const hasResults = $el.find("#resultsPerPage").length > 0;
          cy.log(`Has results page selector: ${hasResults}`);
          return cy.wrap(hasResults, { log: false });
        })
        .then((hasResults) => {
          if (!hasResults) {
            cy.log(`**No results found for '${phrase}'**`);
            return;
          }

          cy.log("**Results found, setting to 100 per page**");
          cy.get("#resultsPerPage")
            .scrollIntoView()
            .select("100")
            .closest("form")
            .within(() => {
              cy.contains('input[type="submit"]', "Go").click();
            });

          //          cy.wait("@search", { timeout: 30000 });
          cy.document().its("readyState").should("eq", "complete");

          // Count items for sanity + screenshot of the list wrapper
          cy.get("#searchresults")
            .should("exist")
            .then(($list) => {
              const count = $list.find("li").length;
              cy.log(`Found ${count} result item(s)`);
            });

          cy.get("#searchresults li").each(($li, index) => {
            // per-item screenshot (optional but very helpful)
            cy.wrap($li).screenshot(`item-${index}-${tag}`, {
              capture: "viewport",
            });

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
              phrase,
              link: `${CnE_URL_BASE}${$link.attr("href")}`,
              proposal: $link.text().trim(),
              address,
              postcode: getPostcode(address),
              refNo,
              received,
              validated,
              status,
              council: "CnE"
            };

            if (application.postcode) {
              newCnEApplications.push(application);
            }
          });
        });
    });
  });


  it(`Saves all CnE applications - ${newCnEApplications.length}`, () => {
    cy.log(`**Saving ${newCnEApplications.length} CnE application(s)**`);
    cy.writeFile(
      CnE_APPLICATIONS_FILE,
      JSON.stringify(newCnEApplications, null, 2)
    );
  });
});




const ED_SEARCH_PHRASES = ["short term let", "holiday let"];

describe("Searches Edinburgh council planning site", () => {
  ED_SEARCH_PHRASES.forEach((phrase) => {
    it(`Finds new applications for '${phrase}'`, () => {
      cy.log(`**Starting Edinburgh search for '${phrase}'**`);
      cy.visit(SEARCH_URL, { failOnStatusCode: false });

      cy.get("#description").scrollIntoView().clear().type(phrase);
      cy.get("#caseStatus").scrollIntoView().select("Awaiting Assessment");
      cy.get("#applicationReceivedStart")
        .scrollIntoView()
        .clear()
        .type(
          [
            START_DATE.getDate(),
            START_DATE.getMonth() + 1, // month is 0-based
            START_DATE.getFullYear(),
          ].join("/")
        );

      cy.get('input[type="submit"]').contains("Search").click();

      cy.get(".content")
        .then(($el) => {
          const hasResults = $el.find("#resultsPerPage").length > 0;
          cy.log(`Has results page selector: ${hasResults}`);
          return cy.wrap(hasResults, { log: false });
        })
        .then((hasResults) => {
          if (!hasResults) {
            cy.log(`**No results found for '${phrase}'**`);
            return;
          }

          cy.log("**Results found, setting to 100 per page**");
          cy.get("#resultsPerPage").select("100");
          cy.get('input[type="submit"]').contains("Go").click();

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
              phrase,
              link: `${URL_BASE}${$link.attr("href")}`,
              proposal: $link.text().trim(),
              address,
              postcode: getPostcode(address),
              refNo,
              received,
              validated,
              status,
              council: "Edinburgh"
            };

            if (application.postcode) {
              newApplications.push(application);
            }
          });
        });
    });
  });

  it("Saves all Edinburgh applications", () => {
    cy.log(`**Saving ${newApplications.length} Edinburgh application(s)**`);
    cy.writeFile(APPLICATIONS_FILE, JSON.stringify(newApplications, null, 2));
  });
});



const HL_SEARCH_PHRASES = ["short term let", "holiday let"];

describe("Searches Highland council planning site", () => {
  HL_SEARCH_PHRASES.forEach((phrase) => {
    it(`Finds new applications for '${phrase}'`, () => {
      cy.log(`**Starting Highland search for '${phrase}'**`);
      cy.visit(HL_SEARCH_URL, { failOnStatusCode: false });

      // Cookie banner
      cy.get('button:contains("I Accept")', { timeout: 2000 }).then(($btn) => {
        if ($btn.length) cy.wrap($btn).click({ force: true });
      });

      // Fill the form
      cy.get("#description")
        .scrollIntoView()
        .should("be.visible")
        .clear()
        .type(phrase);
      cy.get("#caseStatus")
        .scrollIntoView()
        .should("be.visible")
        .select("Under Consideration");
      cy.get("#applicationReceivedStart")
        .scrollIntoView()
        .should("be.visible")
        .clear()
        .type(
          [
            START_DATE.getDate(),
            START_DATE.getMonth() + 1,
            START_DATE.getFullYear(),
          ].join("/")
        );

      // Submit
      cy.get("#description")
        .closest("form")
        .within(() => {
          cy.contains('input[type="submit"]', "Search").click();
        });

      // Check results
      cy.get(".content")
        .then(($el) => {
          const hasResults = $el.find("#resultsPerPage").length > 0;
          cy.log(`Has results page selector: ${hasResults}`);
          return cy.wrap(hasResults, { log: false });
        })
        .then((hasResults) => {
          if (!hasResults) {
            cy.log(`**No results found for '${phrase}'**`);
            return;
          }

          cy.log("**Results found, setting to 100 per page**");
          cy.get("#resultsPerPage")
            .scrollIntoView()
            .select("100")
            .closest("form")
            .within(() => {
              cy.contains('input[type="submit"]', "Go").click();
            });

          cy.get("#searchresults li").each(($li, index) => {
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
              phrase,
              link: `${HL_URL_BASE}${$link.attr("href")}`,
              proposal: $link.text().trim(),
              address,
              postcode: getPostcode(address),
              refNo,
              received,
              validated,
              status,
              council: "Highlands"
            };

            if (application.postcode) {
              newHLApplications.push(application);
            }
          });
        });
    });
  });

  it("Saves all Highland applications", () => {
    cy.log(`**Saving ${newHLApplications.length} Highland application(s)**`);
    cy.writeFile(
      HL_APPLICATIONS_FILE,
      JSON.stringify(newHLApplications, null, 2)
    );
  });
});
