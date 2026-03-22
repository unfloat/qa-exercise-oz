import "./commands";

// ── Runtime infrastructure guard ───────────────────────────────────────────────
//
// The pre-run health check in cypress.config.js catches services that are
// down before any test runs. This guard catches the case where a service
// *goes down mid-run* — e.g. the proxy crashes on a specific request, or
// the mock downstream is killed externally.
//
// It runs once before every spec file (not before every test — that would
// add too much overhead). If either service is unreachable at this point,
// the entire spec is skipped with a clear infrastructure message.

before(() => {
  cy.assertMockIsReachable();
  cy.assertProxyIsReachable();
});

// ── Global failure handler ─────────────────────────────────────────────────────
//
// Cypress surfaces connection-level errors (ECONNREFUSED, ETIMEDOUT) as
// generic "cy.request() failed" messages that look identical to assertion
// failures. This handler intercepts those errors and rewrites them with
// a message that distinguishes infrastructure problems from test logic problems.
//
// It checks the error message for known connection-failure strings, then
// appends a diagnostic hint before re-throwing so Cypress still marks the
// test as failed (not errored) and shows it in the correct place in the report.

Cypress.on("fail", (error, runnable) => {
  const msg = error.message || "";

  const isMockFailure =
    msg.includes("localhost:8085") &&
    (msg.includes("ECONNREFUSED") ||
      msg.includes("socket hang up") ||
      msg.includes("network error") ||
      msg.includes("Failed to fetch"));

  const isProxyFailure =
    msg.includes("localhost:8000") &&
    (msg.includes("ECONNREFUSED") ||
      msg.includes("socket hang up") ||
      msg.includes("network error") ||
      msg.includes("Failed to fetch"));

  if (isMockFailure) {
    error.message =
      `\n` +
      `  ✗ INFRASTRUCTURE FAILURE — Mock downstream is not responding\n` +
      `    Port: 8085\n` +
      `    Test: "${runnable.fullTitle()}"\n\n` +
      `  The mock downstream crashed or was stopped during the test run.\n` +
      `  This is not a bug in the code under test.\n\n` +
      `  Original error: ${msg}\n`;
  }

  if (isProxyFailure) {
    error.message =
      `\n` +
      `  ✗ INFRASTRUCTURE FAILURE — Proxy service is not responding\n` +
      `    Port: 8000\n` +
      `    Test: "${runnable.fullTitle()}"\n\n` +
      `  The proxy service crashed or was stopped during the test run.\n` +
      `  Check the terminal running "uv run main.py".\n\n` +
      `  Original error: ${msg}\n`;
  }

  // Re-throw so Cypress still fails the test — we only changed the message.
  throw error;
});