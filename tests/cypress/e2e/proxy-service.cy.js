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

  // 3. The proxy expects a json response body from downstream server
  describe("REQ-3: Proxy expects a JSON response from downstream", () => {
    it("should handle a valid JSON response from downstream", () => {
      cy.configureMock({
        statusCode: 200,
        body: { user: "test", data: "value" },
      });

      cy.request({
        method: "POST",
        url: "/api/data",
        body: { user: 1 },
      }).then((response) => {
        expect(response.status).to.eq(200);
      });
    });
    it("should return an error when downstream returns non-JSON (plain text)", () => {
      cy.configureMock({
        useRawBody: true,
        rawBody: "This is plain text, not JSON",
        contentType: "text/plain",
        statusCode: 200,
      });

      cy.request({
        method: "POST",
        url: "/api/data",
        body: { user: 1 },
        failOnStatusCode: false,
      }).then((response) => {
        expect(response.status).to.be.gte(400);
      });
    });

    it("should return an error when downstream returns HTML", () => {
      cy.configureMock({
        useRawBody: true,
        rawBody: "<html><body>Error</body></html>",
        contentType: "text/html",
        statusCode: 200,
      });

      cy.request({
        method: "POST",
        url: "/api/data",
        body: { user: 1 },
        failOnStatusCode: false,
      }).then((response) => {
        expect(response.status).to.be.gte(400);
      });
    });
  });

  // 4. The response json body from downstream server should always contain a key called "user" else it should throw an error and return 400.
  describe('REQ-4: Downstream response must contain "user" key', () => {
    it('should return 400 when downstream response is missing "user" key', () => {
      cy.configureMock({
        body: { token: "abc123", expires_in: 3600 },
      });

      cy.request({
        method: "POST",
        url: "/api/login",
        body: { user: 40, password: "12345" },
        failOnStatusCode: false,
      }).then((response) => {
        expect(response.status).to.eq(400);
        expect(response.body.detail).to.include("user");
      });
    });

    it("should return 400 when downstream returns an empty JSON object", () => {
      cy.configureMock({ body: {} });

      cy.request({
        method: "POST",
        url: "/api/login",
        body: { user: 40 },
        failOnStatusCode: false,
      }).then((response) => {
        expect(response.status).to.eq(400);
      });
    });

    it('should succeed when downstream response contains "user" key', () => {
      cy.configureMock({
        body: { user: "john", token: "xyz789" },
      });

      cy.request({
        method: "POST",
        url: "/api/login",
        body: { user: 40 },
      }).then((response) => {
        expect(response.status).to.eq(200);
      });
    });
  });

  // 5. The "user" key from the response body will be removed and rest of the body will be returned from proxy server

  describe('REQ-5: "user" key is removed from the proxy response', () => {
    it('should remove "user" key and preserve other keys in the response', () => {
      cy.configureMock({
        body: { user: "john", token: "abc123xyz", expires_in: 3600 },
      });

      cy.request({
        method: "POST",
        url: "/api/login",
        body: { user: 40, password: "12345" },
      }).then((response) => {
        expect(response.status).to.eq(200);
        expect(response.body).to.not.have.property("user");
        expect(response.body).to.have.property("token", "abc123xyz");
        expect(response.body).to.have.property("expires_in", 3600);
      });
    });

    it("should preserve all non-user keys in the response", () => {
      cy.configureMock({
        body: { user: "jane", name: "Jane", role: "admin", active: true },
      });

      cy.request({
        method: "POST",
        url: "/api/profile",
        body: { user: 1 },
      }).then((response) => {
        expect(response.status).to.eq(200);
        expect(response.body).to.not.have.property("user");
        expect(response.body).to.deep.equal({
          name: "Jane",
          role: "admin",
          active: true,
        });
      });
    });

    it('should return an empty object when downstream only returns "user"', () => {
      cy.configureMock({
        body: { user: "only-user" },
      });

      cy.request({
        method: "POST",
        url: "/api/test",
        body: { user: 1 },
      }).then((response) => {
        expect(response.status).to.eq(200);
        expect(response.body).to.not.have.property("user");
        expect(Object.keys(response.body)).to.have.length(0);
      });
    });
  });
});


// Proxy routing and forwarding behavior
describe("Proxy routing and forwarding", () => {
    it("should forward the request path to the downstream server", () => {
      cy.request({
        method: "POST",
        url: "/api/login",
        body: { user: 40 },
      });

      cy.getMockRequests().then((requests) => {
        expect(requests).to.have.length.greaterThan(0);
        const last = requests[requests.length - 1];
        expect(last.path).to.eq("/api/login");
        expect(last.method).to.eq("POST");
      });
    });

    it("should forward the full request body to the downstream server", () => {
      const requestBody = { user: 40, password: "12345", extra: "data" };

      cy.request({
        method: "POST",
        url: "/api/login",
        body: requestBody,
      });

      cy.getMockRequests().then((requests) => {
        const last = requests[requests.length - 1];
        expect(last.body).to.deep.equal(requestBody);
      });
    });

    it("should handle deeply nested URL paths", () => {
      cy.request({
        method: "POST",
        url: "/a/b/c/d/e",
        body: { user: 1 },
      });

      cy.getMockRequests().then((requests) => {
        const last = requests[requests.length - 1];
        expect(last.path).to.eq("/a/b/c/d/e");
      });
    });

    it("should work with various API paths", () => {
      const paths = ["/api/login", "/api/users", "/data", "/health/check"];

      paths.forEach((path) => {
        cy.request({
          method: "POST",
          url: path,
          body: { user: 1 },
        }).then((response) => {
          expect(response.status).to.eq(200);
        });
      });
    });
  });

