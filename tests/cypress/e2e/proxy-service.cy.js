const MOCK_URL = "http://localhost:8085";

// `beforeEach` calls `cy.resetMock()` to ensure a clean state.
describe("Proxy Service", () => {
  beforeEach(() => {
    cy.resetMock();
  });

  // 1. The proxy expects a JSON request body
  describe("REQ-1: Proxy expects a JSON request body", () => {
    it("should accept a valid JSON request body", () => {
      cy.request({
        method: "POST",
        url: "/api/login",
        body: { user: 40, password: "12345" },
      }).then((resp) => {
        expect(resp.status).to.eq(200);
      });
    });

    it("should reject a non-JSON (plain text) request body", () => {
      cy.request({
        method: "POST",
        url: "/api/login",
        headers: { "Content-Type": "text/plain" },
        body: "not a json",
        failOnStatusCode: false,
      }).then((response) => {
        expect(response.status).to.be.gte(400);
      });
    });

    it("should reject a request with malformed JSON", () => {
      cy.request({
        method: "POST",
        url: "/api/login",
        headers: { "Content-Type": "text/plain" },
        body: '{"user": 40, broken}',
        failOnStatusCode: false,
      }).then((response) => {
        expect(response.status).to.be.gte(400);
      });
    });
  });
});
