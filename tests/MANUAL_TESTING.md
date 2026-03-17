# Manual Testing Approach — Proxy Service

## Overview

This document describes how to manually test the Simple Proxy Service. The proxy accepts POST requests, validates the request body, forwards it to a downstream server, validates the downstream response, strips the `"user"` key, and returns the rest.


## Setup

### 1. Start the mock downstream service

The automation test suite includes a ready-made mock. You can start it standalone:

```bash
cd tests
node -e "require('./mock-downstream').start(8085)"
```

Then configure it via HTTP:

```bash
# Set what the downstream returns
curl -X POST http://localhost:8085/__mock/configure \
  -H "Content-Type: application/json" \
  -d '{"body": {"user": "john", "token": "abc123", "expires_in": 3600}}'

# Reset to defaults
curl -X POST http://localhost:8085/__mock/reset

# View captured requests
curl http://localhost:8085/__mock/requests

### 2. Start the proxy service

From the project root:

```bash
uv run main.py
```

Confirm the proxy is running:

```
INFO: Uvicorn running on http://localhost:8000 (Press CTRL+C to quit)
```
## HTTP client

The test cases below use **cURL**. Equivalent Postman steps are noted where helpful.

## Test Cases

### TC-01: Happy path — Valid request and response

**Objective:** Verify the proxy accepts a valid request, forwards it, and returns the downstream response with `"user"` removed.

**Precondition:** Mock downstream is configured to return:
```json
{ "user": "john", "token": "abc123xyz", "expires_in": 3600 }
```

**Steps:**

```bash
curl -X POST http://localhost:8000/api/login \
  -H "Content-Type: application/json" \
  -d '{"user": 40, "password": "12345"}'
```

**Expected result:**
- Status: `200 OK`
- Body: `{"token": "abc123xyz", "expires_in": 3600}` (no `"user"` key)

---

### TC-02: Missing `"user"` in request body

**Objective:** Verify the proxy rejects requests without a `"user"` key.

**Steps:**

```bash
curl -X POST http://localhost:8000/api/login \
  -H "Content-Type: application/json" \
  -d '{"password": "12345"}'
```

**Expected result:**
- Status: `400 Bad Request`
- Body contains error detail mentioning "user"

---

### TC-03: Empty request body

**Objective:** Verify the proxy rejects an empty JSON object.

**Steps:**

```bash
curl -X POST http://localhost:8000/api/login \
  -H "Content-Type: application/json" \
  -d '{}'
```

**Expected result:**
- Status: `400 Bad Request`

---

### TC-04: Non-JSON request body

**Objective:** Verify the proxy rejects non-JSON content.

**Steps:**

```bash
curl -X POST http://localhost:8000/api/login \
  -H "Content-Type: text/plain" \
  -d 'this is not json'
```

**Expected result:**
- Status: `4xx` (400 or 422 depending on framework handling)

---

### TC-05: Malformed JSON request

**Objective:** Verify the proxy rejects syntactically invalid JSON.

**Steps:**

```bash
curl -X POST http://localhost:8000/api/login \
  -H "Content-Type: application/json" \
  -d '{"user": 40, broken}'
```

**Expected result:**
- Status: `4xx` (400 or 422)

---

### TC-06: `"user"` key with different value types

**Objective:** Verify the proxy accepts `"user"` regardless of value type.

**Steps:**

```bash
# user as number
curl -X POST http://localhost:8000/api/test \
  -H "Content-Type: application/json" \
  -d '{"user": 40}'

# user as string
curl -X POST http://localhost:8000/api/test \
  -H "Content-Type: application/json" \
  -d '{"user": "john"}'

# user as null
curl -X POST http://localhost:8000/api/test \
  -H "Content-Type: application/json" \
  -d '{"user": null}'

# user as boolean
curl -X POST http://localhost:8000/api/test \
  -H "Content-Type: application/json" \
  -d '{"user": true}'
```

**Expected result:**
- Status: `200 OK` for all four requests

---

### TC-07: Downstream response missing `"user"` key

**Objective:** Verify the proxy returns 400 when the downstream response has no `"user"` key.

**Precondition:** Configure mock downstream to return:
```json
{ "token": "abc123", "expires_in": 3600 }
```

**Steps:**

```bash
curl -X POST http://localhost:8000/api/login \
  -H "Content-Type: application/json" \
  -d '{"user": 40, "password": "12345"}'
```

**Expected result:**
- Status: `400 Bad Request`
- Body contains error detail mentioning "user"

---

### TC-08: Downstream returns non-JSON response

**Objective:** Verify the proxy handles non-JSON downstream responses gracefully.

**Precondition:** Configure mock downstream to return plain text:
```
Content-Type: text/plain
Body: "Internal server error"
```

**Steps:**

```bash
curl -X POST http://localhost:8000/api/data \
  -H "Content-Type: application/json" \
  -d '{"user": 1}'
```

**Expected result:**
- Status: `4xx` or `5xx` (proxy should not crash; it should return an error)

---

### TC-09: `"user"` key is stripped from proxy response

**Objective:** Verify the `"user"` key is removed from the final response while all other keys are preserved.

**Precondition:** Configure mock downstream to return:
```json
{ "user": "john", "token": "abc123xyz", "expires_in": 3600, "role": "admin" }
```

**Steps:**

```bash
curl -X POST http://localhost:8000/api/login \
  -H "Content-Type: application/json" \
  -d '{"user": 40, "password": "12345"}'
```

**Expected result:**
- Status: `200 OK`
- Body: `{"token": "abc123xyz", "expires_in": 3600, "role": "admin"}`
- The `"user"` key must NOT appear in the response

> **Note:** This test case currently fails due to a [known bug](#known-bug) in the service.

---

### TC-10: Non-POST HTTP methods are rejected

**Objective:** Verify only POST is accepted; all other methods return 405.

**Steps:**

```bash
curl -X GET http://localhost:8000/api/login

curl -X PUT http://localhost:8000/api/login \
  -H "Content-Type: application/json" \
  -d '{"user": 1}'

curl -X DELETE http://localhost:8000/api/login

curl -X PATCH http://localhost:8000/api/login \
  -H "Content-Type: application/json" \
  -d '{"user": 1}'
```

**Expected result:**
- Status: `405 Method Not Allowed` for all four requests

---

### TC-11: Request path is forwarded correctly

**Objective:** Verify the proxy passes the URL path through to the downstream server.

**Precondition:** Mock downstream logs incoming requests.

**Steps:**

```bash
curl -X POST http://localhost:8000/api/login \
  -H "Content-Type: application/json" \
  -d '{"user": 1}'

curl -X POST http://localhost:8000/data/users/profile \
  -H "Content-Type: application/json" \
  -d '{"user": 1}'
```

**Verification:** Check the mock downstream's request log:
- First request should arrive at path `/api/login`
- Second request should arrive at path `/data/users/profile`

---

### TC-12: Request body is forwarded correctly

**Objective:** Verify the proxy sends the exact request body to the downstream.

**Precondition:** Mock downstream logs incoming request bodies.

**Steps:**

```bash
curl -X POST http://localhost:8000/api/login \
  -H "Content-Type: application/json" \
  -d '{"user": 40, "password": "12345", "remember": true}'
```

**Verification:** Check the mock downstream received exactly:
```json
{ "user": 40, "password": "12345", "remember": true }
```

---

## Setting Up a Mock Downstream

You need a controllable HTTP server on port 8085 to act as the downstream target. Here are several options:

### Option A: Use the test suite's mock server (recommended)

The automation test suite includes a ready-made mock. You can start it standalone:

```bash
cd tests
node -e "require('./mock-downstream').start(8085)"
```

Then configure it via HTTP:

```bash
# Set what the downstream returns
curl -X POST http://localhost:8085/__mock/configure \
  -H "Content-Type: application/json" \
  -d '{"body": {"user": "john", "token": "abc123", "expires_in": 3600}}'

# Reset to defaults
curl -X POST http://localhost:8085/__mock/reset

# View captured requests
curl http://localhost:8085/__mock/requests
```

### Option B: Use Mockoon (GUI tool)

1. Download [Mockoon](https://mockoon.com/)
2. Create a new environment on port 8085
3. Add a catch-all route that returns the JSON you need
4. Start the mock environment

### Option C: Quick Python mock

```python
from flask import Flask, request, jsonify

app = Flask(__name__)

@app.route("/<path:path>", methods=["POST"])
def catch_all(path):
    print(f"Received: {request.method} /{path}")
    print(f"Body: {request.json}")
    return jsonify({"user": "test", "token": "abc123", "expires_in": 3600})

app.run(port=8085)
```

### Option D: Quick Node.js mock

```javascript
const http = require("http");
http.createServer((req, res) => {
  let body = "";
  req.on("data", (chunk) => (body += chunk));
  req.on("end", () => {
    console.log(`${req.method} ${req.url} — ${body}`);
    res.writeHead(200, { "Content-Type": "application/json" });
    res.end(JSON.stringify({ user: "test", token: "abc123", expires_in: 3600 }));
  });
}).listen(8085, () => console.log("Mock running on :8085"));
```

---

## Known Bug

There is a bug in `main.py` line 24:

```python
body.pop("customer", None)   # BUG: should be "user", not "customer"
```

This means the `"user"` key is **not** removed from the response, violating Requirement 5. Test cases TC-01 and TC-09 will observe this incorrect behavior until the bug is fixed.

**Fix:** Change `"customer"` to `"user"`:

```python
body.pop("user", None)
```

---

## Checklist Summary

| # | Test Case | Req | Expected | Pass? |
|---|-----------|-----|----------|-------|
| TC-01 | Happy path | All | 200, `"user"` removed | Fails (bug) |
| TC-02 | Missing `"user"` in request | 2 | 400 | Pass |
| TC-03 | Empty request body | 2 | 400 | Pass |
| TC-04 | Non-JSON request body | 1 | 4xx | Pass |
| TC-05 | Malformed JSON | 1 | 4xx | Pass |
| TC-06 | `"user"` with various types | 2 | 200 | Pass |
| TC-07 | No `"user"` in downstream response | 4 | 400 | Pass |
| TC-08 | Non-JSON downstream response | 3 | 4xx/5xx | Pass |
| TC-09 | `"user"` stripped from response | 5 | 200, no `"user"` | Fails (bug) |
| TC-10 | Non-POST methods | — | 405 | Pass |
| TC-11 | Path forwarded | — | Correct path | Pass |
| TC-12 | Body forwarded | — | Exact body | Pass |
