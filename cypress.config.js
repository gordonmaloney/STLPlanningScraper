const { defineConfig } = require("cypress");

module.exports = defineConfig({
  e2e: {
    // Look for any .cy.js/.cy.ts under cypress/ (including the root)
    specPattern: "cypress/**/*.cy.{js,ts}",

    // If you’ve got no support file, disable it:
    supportFile: false,

    setupNodeEvents(on, config) {
      on("task", {
        log(output) {
          console.log(output);
          return null;
        },
      });
    },
  },
  defaultCommandTimeout: 10000,
  screenshotOnRunFailure: false,
  watchForFileChanges: false,
});
