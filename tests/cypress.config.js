const { defineConfig } = require("cypress");
const http = require("http");

/**
 * Attempts a single HTTP GET/POST to the given URL.
 * Resolves with true on any HTTP response (even 4xx/5xx),
 * rejects on connection-level errors (ECONNREFUSED, ETIMEDOUT, etc.).
 */
function probe(url) {
  return new Promise((resolve, reject) => {
    const req = http.request(url, { method: "GET" }, (res) => {
      res.resume(); // drain so the socket closes cleanly
      resolve(true);
    });
    req.setTimeout(1500, () => {
      req.destroy(new Error("timeout"));
    });
    req.on("error", reject);
    req.end();
  });
}

/**
 * Retries probe() up to `attempts` times with a delay between each.
 * Throws a clear, human-readable error if all attempts fail.
 */
async function waitForService(name, url, { attempts = 10, delayMs = 500 } = {}) {
  for (let i = 1; i <= attempts; i++) {
    try {
      await probe(url);
      console.log(`  ✓ ${name} is reachable at ${url}`);
      return;
    } catch (err) {
      const isLastAttempt = i === attempts;
      if (isLastAttempt) {
        throw new Error(
          `\n\n` +
          `  ✗ INFRASTRUCTURE ERROR: ${name} is not reachable.\n` +
          `    URL:    ${url}\n` +
          `    Reason: ${err.message}\n\n` +
          `  This is not a test failure — a required service is down.\n` +
          `  ► Make sure ${name} is running before starting Cypress.\n`
        );
      }
      console.log(`  … waiting for ${name} (attempt ${i}/${attempts})`);
      await new Promise((r) => setTimeout(r, delayMs));
    }
  }
}

module.exports = defineConfig({
  e2e: {
    baseUrl: "http://localhost:8000",
    supportFile: "cypress/support/e2e.js",
    specPattern: "cypress/e2e/**/*.cy.js",

    async setupNodeEvents(on, config) {
      // ── Start the mock downstream ──────────────────────────────────────────
      const { start } = require("./mock-downstream");
      await start(8085);

      // ── Pre-run health checks ──────────────────────────────────────────────
      // Runs once before any spec file is executed.
      // If either service is unreachable the entire run aborts immediately
      // with a message that points to the infrastructure problem, not a test.
      on("before:run", async () => {
        console.log("\n── Pre-run health checks ────────────────────────────────");

        await Promise.all([
          waitForService(
            "Proxy service (FastAPI)",
            "http://localhost:8000",
            { attempts: 10, delayMs: 500 }
          ),
          waitForService(
            "Mock downstream (Express)",
            "http://localhost:8085/__mock/requests",
            { attempts: 10, delayMs: 500 }
          ),
        ]);

        console.log("── All services ready — starting tests ──────────────────\n");
      });

      return config;
    },
  },
});