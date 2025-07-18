/// <reference types="cypress" />

// ─── Prevent Cypress from failing on uncaught exceptions in the application under test ───
Cypress.on("uncaught:exception", (err, runnable) => {
  // return false to prevent Cypress from
  // failing the test due to errors in the application
  return false;
});

const URL_BASE = "https://citydev-portal.edinburgh.gov.uk";
const SEARCH_URL = `${URL_BASE}/idoxpa-web/search.do?action=advanced`;
const SEARCH_PHRASE = "short term let";
const APPLICATIONS_FILE = `${Cypress.config(
  "fileServerFolder"
)}/data/applications.json`;
let newApplications = [];

const getDaysAgo = (days) => {
  const date = new Date();
  date.setDate(date.getDate() - days);
  return date;
};

const START_DATE = getDaysAgo(90);

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
