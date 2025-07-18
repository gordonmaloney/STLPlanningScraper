/// <reference types="cypress" />

+// ─── prevent Cypress from failing the test on network errors ───
+Cypress.on('fail', (err, runnable) => {
+  // swallow only cy.visit() failures
+  if (err.message.includes('cy.visit() failed')) {
+    return false
+  }
+  // let all other errors bubble up
+  throw err
+})

const URL_BASE = "https://citydev-portal.edinburgh.gov.uk";
const SEARCH_URL = `${URL_BASE}/idoxpa-web/search.do?action=advanced`;
const APPLICATIONS_FILE = `${Cypress.config("fileServerFolder")}/data/applications.json`;

describe("Searches Edinburgh council planning site", () => {
  it("scrapes and saves new applications", () => {
    const newApplications = [];

    // ─── build formatted date ───
    const getDaysAgo = (days) => {
      const d = new Date();
      d.setDate(d.getDate() - days);
      return d;
    };
    const START = getDaysAgo(90);
    const day   = String(START.getDate()).padStart(2, "0");
    const month = String(START.getMonth() + 1).padStart(2, "0");
    const year  = START.getFullYear();
    const formattedDate = `${day}/${month}/${year}`;

    // ─── postcode extractor ───
    const getPostcode = (str) => {
      const m = str.match(/[A-Za-z0-9]{3,4}\s[A-Za-z0-9]{3,4}$/);
      return m ? m[0] : "";
    };

    // 1) try to visit
    cy.visit(SEARCH_URL);

    // 2) fill & submit
    cy.get("#description").clear().type("short term let");
    cy.get("#caseStatus").select("Awaiting Assessment");
    cy.get("#applicationReceivedStart").clear().type(formattedDate);
    cy.get('input[type="submit"]').contains("Search").click();

    // 3) if results exist, scrape them
    cy.get(".content").then(($content) => {
      if (!$content.find("#resultsPerPage").length) {
        cy.log("⚠️ No results found, skipping scrape");
        return;
      }

      cy.get("#resultsPerPage").select("100");
      cy.get('input[type="submit"]').contains("Go").click();

      cy.get("#searchresults li").each(($li) => {
        const $link = $li.find("a");
        const meta = $li.find(".metaInfo").text()
          .replace(/\n/g, "")
          .replace(/\s+/g, " ")
          .trim();
        const [refNo, received, validated, status] = meta.split(" | ");
        const address = $li.find(".address").text().trim();

        newApplications.push({
          link:      `${URL_BASE}${$link.attr("href")}`,
          proposal:  $link.text().trim(),
          address,
          postcode:  getPostcode(address),
          refNo,
          received,
          validated,
          status,
        });
      });
    })
    // 4) finally, write (even if empty)
    .then(() => {
      cy.log(`💾 Writing ${newApplications.length} applications`);
      cy.writeFile(APPLICATIONS_FILE, JSON.stringify(newApplications, null, 2));
    });
  });
});
