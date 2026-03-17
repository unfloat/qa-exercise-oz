const MOCK_URL = "http://localhost:8085";

Cypress.Commands.add("configureMock", (config) => {
  return cy.request({
    method: "POST",
    url: `${MOCK_URL}/__mock/configure`,
    body: config,
  });
});

Cypress.Commands.add("resetMock", () => {
  return cy.request({
    method: "POST",
    url: `${MOCK_URL}/__mock/reset`,
  });
});

Cypress.Commands.add("getMockRequests", () => {
  return cy.request({
    method: "GET",
    url: `${MOCK_URL}/__mock/requests`,
  }).its("body");
});
