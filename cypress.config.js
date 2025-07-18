const { defineConfig } = require("cypress");

module.exports = defineConfig({
  e2e: {
    // Look for any .cy.js/.cy.ts under cypress/ (including the root)
    specPattern: "cypress/**/*.cy.{js,ts}",

    // If you’ve got no support file, disable it:
    supportFile: false,

    // (Optional) set a baseUrl so you can use cy.visit('/')
    // baseUrl: 'https://your-target-site.com',
  },
});
