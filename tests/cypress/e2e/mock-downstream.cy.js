const MOCK_URL = "http://localhost:8085";

// Helper — sends a regular POST directly to the mock (not through the proxy)
const hitMock = (path = "/test", body = { user: 1 }) =>
  cy.request({
    method: "POST",
    url: `${MOCK_URL}${path}`,
    body,
    failOnStatusCode: false,
  });

// ─────────────────────────────────────────────────────────────────────────────
// These tests validate the mock downstream server itself (mock-downstream.js).
// They all bypass the proxy entirely and talk to port 8085 directly.
//
// Why this matters: if the mock silently misbehaves, every test that calls
// cy.configureMock() or cy.getMockRequests() becomes unreliable — we'd be
// testing the wrong thing without knowing it.
// ─────────────────────────────────────────────────────────────────────────────

describe("Mock Downstream Server", () => {
  // Always start from a known state
  beforeEach(() => {
    cy.resetMock();
  });

  // ── Default response ────────────────────────────────────────────────────────
  describe("Default response (before any configure call)", () => {
    it.only("should return 200 with the default body", () => {
      hitMock().then((res) => {
        console.log("------------- HERE -------------", res);
        expect(res.status).to.eq(200);
        expect(res.body).to.deep.equal({
          user: "default-user",
          token: "abc123xyz",
          expires_in: 3600,
        });
      });
    });

    it("should return JSON content-type by default", () => {
      hitMock().then((res) => {
        expect(res.headers["content-type"]).to.include("application/json");
      });
    });
  });

  // ── /__mock/reset ───────────────────────────────────────────────────────────
  describe("/__mock/reset", () => {
    it("should return { ok: true }", () => {
      cy.request({
        method: "POST",
        url: `${MOCK_URL}/__mock/reset`,
      }).then((res) => {
        expect(res.status).to.eq(200);
        expect(res.body).to.deep.equal({ ok: true });
      });
    });

    it("should restore the default body after a configure call", () => {
      cy.configureMock({ body: { user: "custom", token: "xyz" } });

      cy.resetMock();

      hitMock().then((res) => {
        expect(res.body).to.deep.equal({
          user: "default-user",
          token: "abc123xyz",
          expires_in: 3600,
        });
      });
    });

    it("should restore the default status code after a configure call", () => {
      cy.configureMock({ statusCode: 503 });

      cy.resetMock();

      hitMock().then((res) => {
        expect(res.status).to.eq(200);
      });
    });

    it("should clear captured requests", () => {
      hitMock("/api/login");
      hitMock("/api/users");

      cy.resetMock();

      cy.getMockRequests().then((requests) => {
        expect(requests).to.have.length(0);
      });
    });
  });

  // ── /__mock/configure ───────────────────────────────────────────────────────
  describe("/__mock/configure", () => {
    it("should return { ok: true }", () => {
      cy.request({
        method: "POST",
        url: `${MOCK_URL}/__mock/configure`,
        body: { statusCode: 200, body: { user: "x" } },
      }).then((res) => {
        expect(res.status).to.eq(200);
        expect(res.body).to.deep.equal({ ok: true });
      });
    });

    it("should change the response body for subsequent requests", () => {
      cy.configureMock({ body: { user: "john", token: "tok-1" } });

      hitMock().then((res) => {
        expect(res.body).to.deep.equal({ user: "john", token: "tok-1" });
      });
    });

    it("should change the response status code", () => {
      cy.configureMock({ statusCode: 503 });

      hitMock().then((res) => {
        expect(res.status).to.eq(503);
      });
    });

    it("should apply only to subsequent requests, not past ones", () => {
      // First request uses default
      hitMock();

      cy.configureMock({ body: { user: "new", data: "changed" } });

      // Only the second request should reflect the new config
      hitMock().then((res) => {
        expect(res.body).to.deep.equal({ user: "new", data: "changed" });
      });

      cy.getMockRequests().then((requests) => {
        // Both requests were captured, but only the second got the new body
        expect(requests).to.have.length(2);
      });
    });

    it("should serve a raw plain-text body when useRawBody is true", () => {
      cy.configureMock({
        useRawBody: true,
        rawBody: "plain text response",
        contentType: "text/plain",
        statusCode: 200,
      });

      hitMock().then((res) => {
        expect(res.headers["content-type"]).to.include("text/plain");
        expect(res.body).to.eq("plain text response");
      });
    });

    it("should serve an HTML body when useRawBody is true with text/html", () => {
      cy.configureMock({
        useRawBody: true,
        rawBody: "<html><body>Error</body></html>",
        contentType: "text/html",
        statusCode: 200,
      });

      hitMock().then((res) => {
        expect(res.headers["content-type"]).to.include("text/html");
      });
    });

    it("should only override the fields provided, keeping others at their current value", () => {
      // Set a custom body first
      cy.configureMock({ body: { user: "alice", token: "t1" } });

      // Now only override the status code — body should be unchanged
      cy.configureMock({ statusCode: 422 });

      hitMock().then((res) => {
        expect(res.status).to.eq(422);
        expect(res.body).to.deep.equal({ user: "alice", token: "t1" });
      });
    });
  });

  // ── /__mock/requests ────────────────────────────────────────────────────────
  describe("/__mock/requests", () => {
    it("should return an empty array before any requests", () => {
      cy.getMockRequests().then((requests) => {
        expect(requests).to.deep.equal([]);
      });
    });

    it("should capture the method of each request", () => {
      hitMock("/api/login");

      cy.getMockRequests().then((requests) => {
        expect(requests[0].method).to.eq("POST");
      });
    });

    it("should capture the path of each request", () => {
      hitMock("/api/login");

      cy.getMockRequests().then((requests) => {
        expect(requests[0].path).to.eq("/api/login");
      });
    });

    it("should capture the request body", () => {
      hitMock("/api/login", { user: 42, password: "secret" });

      cy.getMockRequests().then((requests) => {
        expect(requests[0].body).to.deep.equal({ user: 42, password: "secret" });
      });
    });

    it("should accumulate multiple requests in order", () => {
      hitMock("/first");
      hitMock("/second");
      hitMock("/third");

      cy.getMockRequests().then((requests) => {
        expect(requests).to.have.length(3);
        expect(requests[0].path).to.eq("/first");
        expect(requests[1].path).to.eq("/second");
        expect(requests[2].path).to.eq("/third");
      });
    });

    it("should capture deeply nested paths", () => {
      hitMock("/a/b/c/d");

      cy.getMockRequests().then((requests) => {
        expect(requests[0].path).to.eq("/a/b/c/d");
      });
    });

    it("should not capture /__mock/* admin requests", () => {
      // Admin calls (reset/configure/requests) should never appear in the
      // captured list — only real downstream requests should.
      cy.getMockRequests().then((requests) => {
        const adminCalls = requests.filter((r) =>
          r.path.startsWith("/__mock")
        );
        expect(adminCalls).to.have.length(0);
      });
    });
  });

  // ── Isolation between tests ─────────────────────────────────────────────────
  describe("Test isolation (verifying beforeEach reset works)", () => {
    it("test A: configure a custom response", () => {
      cy.configureMock({ body: { user: "test-a", token: "aaa" } });

      hitMock().then((res) => {
        expect(res.body.token).to.eq("aaa");
      });
    });

    it("test B: should see default response, not test A's config", () => {
      // If reset is working, this test should never see "aaa"
      hitMock().then((res) => {
        expect(res.body).to.deep.equal({
          user: "default-user",
          token: "abc123xyz",
          expires_in: 3600,
        });
      });
    });

    it("test C: captured requests should be empty at the start", () => {
      // If reset is working, requests from test A and B should be gone
      cy.getMockRequests().then((requests) => {
        expect(requests).to.have.length(0);
      });
    });
  });
});