const MOCK_URL = "http://localhost:8085";

describe("Proxy Service", function () {
  beforeEach(function () {
    cy.fixture("requests").as("req");
    cy.fixture("mock-responses").as("mock");
    cy.resetMock();
  });

  describe("REQ-1: Proxy expects a JSON request body", function () {
    it("should accept a valid JSON request body", function () {
      cy.request({
        method: "POST",
        url: "/api/login",
        body: this.req.validLogin,
      }).then((response) => {
        expect(response.status).to.eq(200);
      });
    });

    it("should reject a non-JSON (plain text) request body", function () {
      cy.request({
        method: "POST",
        url: "/api/login",
        headers: { "Content-Type": "text/plain" },
        body: this.req.plainTextBody,
        failOnStatusCode: false,
      }).then((response) => {
        expect(response.status).to.be.gte(400);
      });
    });

    it("should reject a request with malformed JSON", function () {
      cy.request({
        method: "POST",
        url: "/api/login",
        headers: { "Content-Type": "text/plain" },
        body: this.req.malformedJson,
        failOnStatusCode: false,
      }).then((response) => {
        expect(response.status).to.be.gte(400);
      });
    });
  });

  describe("REQ-2: Request body must contain 'user' key", function () {
    it("should return 400 when 'user' key is missing", function () {
      cy.request({
        method: "POST",
        url: "/api/login",
        body: this.req.missingUserKey,
        failOnStatusCode: false,
      }).then((response) => {
        expect(response.status).to.eq(400);
        expect(response.body.detail).to.include("user");
      });
    });

    it("should return 400 for an empty JSON object", function () {
      cy.request({
        method: "POST",
        url: "/api/login",
        body: this.req.emptyObject,
        failOnStatusCode: false,
      }).then((response) => {
        expect(response.status).to.eq(400);
      });
    });

    it("should return 400 when multiple keys exist but not 'user' key", function () {
      cy.request({
        method: "POST",
        url: "/api/login",
        body: this.req.noUserMultipleKeys,
        failOnStatusCode: false,
      }).then((response) => {
        expect(response.status).to.eq(400);
      });
    });

    it("should succeed when 'user' key exists with a numeric value", function () {
      cy.request({
        method: "POST",
        url: "/api/login",
        body: this.req.validLogin,
        failOnStatusCode: false,
      }).then((response) => {
        expect(response.status).to.eq(200);
      });
    });

    it("should succeed when 'user' key exists with a string value", function () {
      cy.request({
        method: "POST",
        url: "/api/login",
        body: this.req.userStringValue,
        failOnStatusCode: false,
      }).then((response) => {
        expect(response.status).to.eq(200);
      });
    });

    it('should succeed when "user" key is present with a null value', function () {
      cy.request({
        method: "POST",
        url: "/api/test",
        body: this.req.userNullValue,
      }).then((response) => {
        expect(response.status).to.eq(200);
      });
    });
  });

  describe("REQ-3: Proxy expects a JSON response from downstream", function () {
    it("should handle a valid JSON response from downstream", function () {
      cy.configureMock(this.mock.validJson);

      cy.request({
        method: "POST",
        url: "/api/data",
        body: this.req.minimalUser,
      }).then((response) => {
        expect(response.status).to.eq(200);
      });
    });

    it("should return an error when downstream returns non-JSON (plain text)", function () {
      cy.configureMock(this.mock.plainText);

      cy.request({
        method: "POST",
        url: "/api/data",
        body: this.req.minimalUser,
        failOnStatusCode: false,
      }).then((response) => {
        expect(response.status).to.be.gte(400);
      });
    });

    it("should return an error when downstream returns HTML", function () {
      cy.configureMock(this.mock.html);

      cy.request({
        method: "POST",
        url: "/api/data",
        body: this.req.minimalUser,
        failOnStatusCode: false,
      }).then((response) => {
        expect(response.status).to.be.gte(400);
      });
    });
  });

  describe('REQ-4: Downstream response must contain "user" key', function () {
    it('should return 400 when downstream response is missing "user" key', function () {
      cy.configureMock(this.mock.missingUserKey);

      cy.request({
        method: "POST",
        url: "/api/login",
        body: this.req.validLogin,
        failOnStatusCode: false,
      }).then((response) => {
        expect(response.status).to.eq(400);
        expect(response.body.detail).to.include("user");
      });
    });

    it("should return 400 when downstream returns an empty JSON object", function () {
      cy.configureMock(this.mock.emptyBody);

      cy.request({
        method: "POST",
        url: "/api/login",
        body: this.req.userNumericId,
        failOnStatusCode: false,
      }).then((response) => {
        expect(response.status).to.eq(400);
      });
    });

    it('should succeed when downstream response contains "user" key', function () {
      cy.configureMock(this.mock.withUserKey);

      cy.request({
        method: "POST",
        url: "/api/login",
        body: this.req.userNumericId,
      }).then((response) => {
        expect(response.status).to.eq(200);
      });
    });
  });

  describe('REQ-5: "user" key is removed from the proxy response', function () {
    it('should remove "user" key and preserve other keys in the response', function () {
      cy.configureMock(this.mock.userWithTokenAndExpiry);

      cy.request({
        method: "POST",
        url: "/api/login",
        body: this.req.validLogin,
      }).then((response) => {
        expect(response.status).to.eq(200);
        expect(response.body).to.not.have.property("user");
        expect(response.body).to.have.property("token", "abc123xyz");
        expect(response.body).to.have.property("expires_in", 3600);
      });
    });

    it("should preserve all non-user keys in the response", function () {
      cy.configureMock(this.mock.userWithProfile);

      cy.request({
        method: "POST",
        url: "/api/profile",
        body: this.req.minimalUser,
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

    it('should return an empty object when downstream only returns "user"', function () {
      cy.configureMock(this.mock.userOnly);

      cy.request({
        method: "POST",
        url: "/api/test",
        body: this.req.minimalUser,
      }).then((response) => {
        expect(response.status).to.eq(200);
        expect(response.body).to.not.have.property("user");
        expect(Object.keys(response.body)).to.have.length(0);
      });
    });
  });

  describe("Proxy routing and forwarding", function () {
    it("should forward the request path to the downstream server", function () {
      cy.request({
        method: "POST",
        url: "/api/login",
        body: this.req.userNumericId,
      });

      cy.getMockRequests().then((requests) => {
        expect(requests).to.have.length.greaterThan(0);
        const last = requests[requests.length - 1];
        expect(last.path).to.eq("/api/login");
        expect(last.method).to.eq("POST");
      });
    });

    it("should forward the full request body to the downstream server", function () {
      cy.request({
        method: "POST",
        url: "/api/login",
        body: this.req.userWithExtra,
      });

      cy.getMockRequests().then((requests) => {
        const last = requests[requests.length - 1];
        expect(last.body).to.deep.equal(this.req.userWithExtra);
      });
    });

    it("should handle deeply nested URL paths", function () {
      cy.request({
        method: "POST",
        url: "/a/b/c/d/e",
        body: this.req.minimalUser,
      });

      cy.getMockRequests().then((requests) => {
        const last = requests[requests.length - 1];
        expect(last.path).to.eq("/a/b/c/d/e");
      });
    });

    it("should work with various API paths", function () {
      const paths = ["/api/login", "/api/users", "/data", "/health/check"];

      paths.forEach((path) => {
        cy.request({
          method: "POST",
          url: path,
          body: this.req.minimalUser,
        }).then((response) => {
          expect(response.status).to.eq(200);
        });
      });
    });
  });

  describe("HTTP method handling (only POST allowed)", function () {
    it("should return 405 for GET requests", function () {
      cy.request({
        method: "GET",
        url: "/api/login",
        failOnStatusCode: false,
      }).then((resp) => {
        expect(resp.status).to.eq(405);
      });
    });

    it("should return 405 for PUT requests", function () {
      cy.request({
        method: "PUT",
        url: "/api/login",
        body: this.req.minimalUser,
        failOnStatusCode: false,
      }).then((resp) => {
        expect(resp.status).to.eq(405);
      });
    });

    it("should return 405 for DELETE requests", function () {
      cy.request({
        method: "DELETE",
        url: "/api/login",
        failOnStatusCode: false,
      }).then((resp) => {
        expect(resp.status).to.eq(405);
      });
    });

    it("should return 405 for PATCH requests", function () {
      cy.request({
        method: "PATCH",
        url: "/api/login",
        body: this.req.minimalUser,
        failOnStatusCode: false,
      }).then((resp) => {
        expect(resp.status).to.eq(405);
      });
    });
  });
});
