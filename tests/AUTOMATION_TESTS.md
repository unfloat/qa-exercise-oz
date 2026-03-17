# Automation Tests — Proxy Service

## Overview

This directory contains end-to-end automation tests for the **Simple Proxy Service** built with Cypress. The tests validate all five technical requirements from the specification, plus additional proxy routing and HTTP method behavior.

---

## Architecture & Approach

The proxy service sits between a client and a downstream server. To test it in isolation without depending on a real downstream service, the test suite spins up a **mock downstream server** (Express.js) that the proxy forwards requests to.

```
┌──────────┐       POST       ┌───────────────┐      Forwards      ┌─────────────────────┐
│  Cypress  │  ──────────────> │  Proxy (8000)  │  ───────────────> │  Mock Downstream     │
│  Tests    │  <────────────── │  (FastAPI)     │  <─────────────── │  (Express on 8085)   │
└──────────┘    Response       └───────────────┘    JSON response   └─────────────────────┘
                                                                      ▲
                                                            /__mock/configure
                                                            /__mock/reset
                                                            /__mock/requests
                                                                      │
                                                              Cypress controls
                                                              mock behavior
                                                              via HTTP calls
```

The mock server exposes **admin endpoints** (`/__mock/*`) that Cypress calls directly (bypassing the proxy) to configure what the downstream returns for each test. This gives each test full control over the downstream behavior.

---

## Prerequisites

1. **Node.js** (v18 or later)
2. **Python 3.12** with `uv` installed (to run the proxy service)
3. The proxy service dependencies installed: run `uv sync` from the project root



## How to Run

### Step 1: Install test dependencies

```bash
cd tests
npm install
```

### Step 2: Start the proxy service

In a **separate terminal**, from the project root:

```bash
uv run main.py
```

You should see:

```
INFO: Uvicorn running on http://localhost:8000 (Press CTRL+C to quit)
```

### Step 3: Run the tests

**Headless mode** (CI-friendly, runs in terminal):

```bash
cd tests
npx cypress run
```

**Interactive mode** (opens Cypress UI for debugging):

```bash
cd tests
npx cypress open
```

> **Note:** The mock downstream server on port 8085 starts automatically when Cypress launches. You do not need to start it manually.

## Test Flow

For each test:

1. `beforeEach` calls `cy.resetMock()` to ensure a clean state.
2. The test optionally calls `cy.configureMock(...)` to set up a specific downstream behavior.
3. The test sends a `cy.request()` to the proxy on port 8000.
4. The proxy forwards the request to the mock downstream on port 8085.
5. The test asserts on the proxy's response (status code, body contents).
6. Optionally, the test calls `cy.getMockRequests()` to verify what the downstream received.

## Cypress Configuration (`cypress.config.js`)

- `baseUrl`: `http://localhost:8000` — All `cy.request()` calls with relative URLs go to the proxy.
- `setupNodeEvents`: Starts the mock downstream server before any tests run.

## Why Cypress for API testing?

Cypress is primarily an E2E browser testing tool, but its `cy.request()` API is excellent for HTTP-level testing. It provides:

- Clean chainable assertion syntax.
- Automatic retries and wait behavior.
- Built-in screenshot capture on failure.
- Interactive test runner for debugging.
- A well-established ecosystem for CI integration.

## Test assertions strategy

- **Exact status codes** (`eq(400)`) where the spec is clear.
- **Range checks** (`gte(400)`) where the exact error code depends on implementation details (e.g., JSON parse errors might return 422 or 500).
- **Body inspection** to verify error messages contain `"user"` and that response stripping works.

## Bug Discovered

The REQ-5 tests (3 tests) **intentionally fail** because they expose a bug in `main.py` line 24:

```python
# Current code (BUGGY):
body.pop("customer", None)

# Should be:
body.pop("user", None)
```

The code removes the `"customer"` key instead of the `"user"` key. Per requirement 5, the `"user"` key from the downstream response should be removed before the proxy returns the response to the client.

### Expected test results after the bug is fixed

All 26 tests should pass once `body.pop("customer", None)` is changed to `body.pop("user", None)`.

---

## Test Results

### Current (with bug present)

```
  23 passing
  3 failing   ← REQ-5 tests (expected failures due to the bug)
```

### After fixing the bug

```
  26 passing
  0 failing
```