const MOCK_URL = "http://localhost:8085";
const PROXY_URL = "http://localhost:8000";

// ── Internal helper ────────────────────────────────────────────────────────────
//
// Wraps a cy.request() call and intercepts network-level failures so that
// "connection refused" surfaces as a clear infrastructure message rather than
// a cryptic Cypress error that points at your test assertion.
//
// Cypress throws on ECONNREFUSED before your .then() chain runs, so we use
// failOnStatusCode:false + a manual status check to keep control.
// For genuine connection errors we rely on cy.on('fail') at the support level.

function mockRequest(options) {
  return cy.request({
    ...options,
    // Never let Cypress throw on a 4xx/5xx — we handle status ourselves
    // so that our error message is shown instead of Cypress's generic one.
    failOnStatusCode: false,
    // A tight timeout so a hung mock surfaces quickly rather than waiting
    // the full Cypress default (30 s).
    timeout: 5000,
  }).then((response) => {
    // If the mock admin endpoint itself returned an unexpected error,
    // surface it clearly before the test can misinterpret the result.
    if (response.status >= 500) {
      throw new Error(
        `\n\n` +
        `  ✗ MOCK DOWNSTREAM ERROR\n` +
        `    Endpoint: ${options.method} ${options.url}\n` +
        `    Status:   ${response.status}\n` +
        `    Body:     ${JSON.stringify(response.body)}\n\n` +
        `  The mock downstream is running but returned an unexpected error.\n` +
        `  This is an infrastructure problem, not a test failure.\n`
      );
    }
    return response;
  });
}

// ── Custom commands ────────────────────────────────────────────────────────────

/**
 * Resets the mock downstream to its default state.
 * Called in beforeEach() to guarantee a clean slate for every test.
 *
 * If this fails with ECONNREFUSED the global fail handler in e2e.js
 * will surface a clear "mock is down" message.
 */
Cypress.Commands.add("resetMock", () => {
  return mockRequest({
    method: "POST",
    url: `${MOCK_URL}/__mock/reset`,
  });
});

/**
 * Configures what the mock downstream will return for the next request.
 *
 * @param {object} config
 * @param {number}  [config.statusCode]   HTTP status code to return (default 200)
 * @param {object}  [config.body]         JSON body to return
 * @param {boolean} [config.useRawBody]   If true, return rawBody as-is
 * @param {string}  [config.rawBody]      Raw body string (used when useRawBody is true)
 * @param {string}  [config.contentType]  Content-Type header for raw responses
 *
 * @example
 * cy.configureMock({ statusCode: 200, body: { user: "john", token: "abc123" } });
 * cy.configureMock({ useRawBody: true, rawBody: "not json", contentType: "text/plain" });
 */
Cypress.Commands.add("configureMock", (config) => {
  return mockRequest({
    method: "POST",
    url: `${MOCK_URL}/__mock/configure`,
    body: config,
  });
});

/**
 * Returns the list of requests the mock downstream has captured since the
 * last reset. Useful for asserting what the proxy actually forwarded.
 *
 * @returns {Array<{ method: string, path: string, body: object }>}
 *
 * @example
 * cy.getMockRequests().then((requests) => {
 *   const last = requests[requests.length - 1];
 *   expect(last.path).to.eq("/api/login");
 * });
 */
Cypress.Commands.add("getMockRequests", () => {
  return mockRequest({
    method: "GET",
    url: `${MOCK_URL}/__mock/requests`,
  }).its("body");
});

/**
 * Asserts the mock downstream is reachable.
 * Can be called explicitly in a test or before() block to verify
 * infrastructure health at any point during a run.
 */
Cypress.Commands.add("assertMockIsReachable", () => {
  return cy
    .request({
      method: "GET",
      url: `${MOCK_URL}/__mock/requests`,
      failOnStatusCode: false,
      timeout: 3000,
    })
    .then((response) => {
      expect(
        response.status,
        `Mock downstream at ${MOCK_URL} is not reachable — ` +
        `did it crash mid-run? Check the terminal where Cypress is running.`
      ).to.be.lessThan(500);
    });
});

/**
 * Asserts the proxy service is reachable.
 * Used in the runtime guard in e2e.js.
 */
Cypress.Commands.add("assertProxyIsReachable", () => {
  return cy
    .request({
      method: "POST",
      url: `${PROXY_URL}/health-probe`,
      body: {},             // intentionally missing "user" — we expect 400, not 502
      failOnStatusCode: false,
      timeout: 3000,
    })
    .then((response) => {
      // Any response from the proxy (even 400/422) means it's up.
      // A 502/503/ECONNREFUSED means it's down.
      expect(
        response.status,
        `Proxy service at ${PROXY_URL} is not reachable — ` +
        `did it crash mid-run? Check the terminal where uv run main.py is running.`
      ).to.not.eq(502).and.to.not.eq(503);
    });
});