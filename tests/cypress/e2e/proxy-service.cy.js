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
      }).then((response) => {
        expect(response.status).to.eq(200);
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

// 2. The json body should always contain a key called "user" else it should throw an error and return 400
describe("REQ-2: Request body must contain 'user' key", () => {
  it("should return 400 when 'user' key is missing", () => {
    cy.request({
      method: "POST",
      url: "/api/login",
      body: { password: "12345" },
      failOnStatusCode: false,
    }).then((response) => {
      expect(response.status).to.eq(400);
      expect(response.body.detail).to.include("user");
    });
  });

  it("should return 400 for an empty JSON object", () => {
    cy.request({
      method: "POST",
      url: "/api/login",
      body: {},
      failOnStatusCode: false,
    }).then((response) => {
      expect(response.status).to.eq(400);
    });
  });

  it("should return 400 when multiple keys exist but not 'user' key", () => {
    cy.request({
      method: "POST",
      url: "/api/login",
      body: { username: "john", password: "secret", role: "admin" },
      failOnStatusCode: false,
    }).then((response) => {
      expect(response.status).to.eq(400);
    });
  });

  it("should succeed when 'user' key exists with a numeric value", () => {
    cy.request({
      method: "POST",
      url: "/api/login",
      body: { user: 40, password: "12345" },
      failOnStatusCode: false,
    }).then((response) => {
      expect(response.status).to.eq(200);
    });
  });

  it("should succeed when 'user' key exists with a string value", () => {
    cy.request({
      method: "POST",
      url: "/api/login",
      body: { user: "john", password: "12345" },
      failOnStatusCode: false,
    }).then((response) => {
      expect(response.status).to.eq(200);
    });
  });

  it('should succeed when "user" key is present with a null value', () => {
    cy.request({
      method: "POST",
      url: "/api/test",
      body: { user: null },
    }).then((response) => {
      expect(response.status).to.eq(200);
    });
  });
});
