// cypress.config.js
const { defineConfig } = require("cypress");

module.exports = defineConfig({
  // top‑level Cypress settings
  defaultCommandTimeout: 10000,
  screenshotOnRunFailure: false,
  watchForFileChanges: false,

  e2e: {
    // your specs live under cypress/, not just e2e/
    specPattern: "cypress/**/*.cy.{js,ts}",

    // point back at the support file you restored
    supportFile: "cypress/support/e2e.js",

    setupNodeEvents(on, config) {
      // example: a simple log task if you still need it
      on("task", {
        log(message) {
          console.log(message);
          return null;
        },
      });
      return config;
    },
  },
});
