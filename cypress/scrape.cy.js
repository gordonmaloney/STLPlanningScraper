/// <reference types="cypress" />

// ───────────── Ignore uncaught exceptions from the page ─────────────
Cypress.on("uncaught:exception", (err, runnable) => {
  // returning false here prevents Cypress from
  // failing the test due to errors in the application under test
  return false;
});

const URL_BASE = "https://citydev-portal.edinburgh.gov.uk";
const SEARCH_URL = `${URL_BASE}/idoxpa-web/search.do?action=advanced`;
const SEARCH_PHRASE = "short term let";
const APPLICATIONS_FILE = `${Cypress.config(
  "fileServerFolder"
)}/data/applications.json`;

describe("Searches Edinburgh council planning site", () => {
  it("scrapes and saves new applications", () => {
    // helper: get N days ago, zero‑pad day/month
    const getDaysAgo = (days) => {
      const d = new Date();
      d.setDate(d.getDate() - days);
      return d;
    };
    const START_DATE = getDaysAgo(90);
    const day = String(START_DATE.getDate()).padStart(2, "0");
    const month = String(START_DATE.getMonth() + 1).padStart(2, "0"); // +1 b/c zero-based
    const year = START_DATE.getFullYear();
    const formattedDate = `${day}/${month}/${year}`;

    // helper: extract postcode from address string
    const getPostcode = (str) => {
      const match = str.match(/[A-Za-z0-9]{3,4}\s[A-Za-z0-9]{3,4}$/);
      return match ? match[0] : "";
    };

    const newApplications = [];

    // 1) Visit & fill form
    cy.visit(SEARCH_URL);
    cy.get("#description").clear().type(SEARCH_PHRASE);
    cy.get("#caseStatus").select("Awaiting Assessment");
    cy.get("#applicationReceivedStart").clear().type(formattedDate);
    cy.get('input[type="submit"]').contains("Search").click();

    // 2) If there are results, set page size, then scrape
    cy.get(".content")
      .then(($content) => {
        if (!$content.find("#resultsPerPage").length) {
          // no results → skip scraping
          return;
        }

        cy.get("#resultsPerPage").select("100");
        cy.get('input[type="submit"]').contains("Go").click();

        cy.get("#searchresults li").each(($li) => {
          const $link = $li.find("a");
          const metaText = $li
            .find(".metaInfo")
            .text()
            .replace(/\n/g, "")
            .replace(/\s+/g, " ")
            .trim();
          const [refNo, received, validated, status] = metaText.split(" | ");
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
      })
      // 3) After scraping, write out the file
      .then(() => {
        expect(newApplications.length).to.be.greaterThan(0); // sanity check
        cy.log(`💾 Writing ${newApplications.length} applications`);
        cy.writeFile(
          APPLICATIONS_FILE,
          JSON.stringify(newApplications, null, 2)
        );
      });
  });
});
