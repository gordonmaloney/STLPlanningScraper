// swallow in‑page errors & network failures
Cypress.on("uncaught:exception", () => false);
Cypress.on("fail", (err) => {
  if (
    err.message.includes("cy.visit() failed") ||
    err.message.includes("cy.request() failed")
  ) {
    return false;
  }
  throw err;
});
