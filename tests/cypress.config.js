const { defineConfig } = require("cypress");

module.exports = defineConfig({
  e2e: {
    baseUrl: "http://localhost:8000",
    supportFile: "cypress/support/e2e.js",
    specPattern: "cypress/e2e/**/*.cy.js",
    async setupNodeEvents(on, config) {
      const { start } = require("./mock-downstream");
      await start(8085);
      return config;
    },
  },
});
