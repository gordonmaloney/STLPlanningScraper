/// <reference types="cypress" />

const URL_BASE = "https://citydev-portal.edinburgh.gov.uk";
const SEARCH_PATH = "/idoxpa-web/search.do";
const SEARCH_PHRASE = "short term let";
const DAYS_BACK = 90;
const APPLICATIONS_FILE = `${Cypress.config(
  "fileServerFolder"
)}/data/applications.json`;

describe("Edinburgh planning scraper (HTTP mode)", () => {
  it("fetches and writes applications.json", () => {
    // 1) Build the date string "DD/MM/YYYY"
    const d = new Date();
    d.setDate(d.getDate() - DAYS_BACK);
    const day = String(d.getDate()).padStart(2, "0");
    const month = String(d.getMonth() + 1).padStart(2, "0");
    const year = d.getFullYear();
    const formattedDate = `${day}/${month}/${year}`;

    // 2) Fetch via HTTP
    cy.request({
      url: URL_BASE + SEARCH_PATH,
      qs: {
        action: "advanced",
        description: SEARCH_PHRASE,
        caseStatus: "Awaiting Assessment",
        applicationReceivedStart: formattedDate,
      },
      headers: { "User-Agent": "Mozilla/5.0" },
      failOnStatusCode: false, // don’t automatically fail on 4xx/5xx
    }).then((resp) => {
      // 3) Ensure we got HTML back
      expect(resp.status).to.equal(200);

      // 4) Parse with the browser DOMParser
      const parser = new DOMParser();
      const doc = parser.parseFromString(resp.body, "text/html");

      // 5) Scrape each result row
      const apps = Array.from(doc.querySelectorAll("#searchresults li")).map(
        (li) => {
          const linkEl = li.querySelector("a");
          const href = linkEl?.getAttribute("href") || "";
          const proposal = linkEl?.textContent.trim() || "";

          const metaText =
            li
              .querySelector(".metaInfo")
              ?.textContent.replace(/\s+/g, " ")
              .trim() || "";
          const [refNo, received, validated, status] = metaText.split(" | ");

          const address =
            li.querySelector(".address")?.textContent.trim() || "";
          const postcode =
            (address.match(/[A-Za-z0-9]{3,4}\s[A-Za-z0-9]{3,4}$/) || [])[0] ||
            "";

          return {
            link: URL_BASE + href,
            proposal,
            address,
            postcode,
            refNo,
            received,
            validated,
            status,
          };
        }
      );

      // 6) Write the JSON out
      cy.writeFile(APPLICATIONS_FILE, apps, { spaces: 2 });
      cy.log(`💾 Wrote ${apps.length} applications`);
    });
  });
});
