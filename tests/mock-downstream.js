const express = require("express");

const DEFAULT_RESPONSE = {
  statusCode: 200,
  body: { user: "default-user", token: "abc123xyz", expires_in: 3600 },
  contentType: "application/json",
  useRawBody: false,
  rawBody: "",
};

let responseConfig = { ...DEFAULT_RESPONSE };
let capturedRequests = [];

function createApp() {
  const app = express();
  app.use(express.json());
  app.use(express.text({ type: "text/*" }));

  app.post("/__mock/configure", (req, res) => {
    responseConfig = { ...responseConfig, ...req.body };
    res.json({ ok: true });
  });

  app.post("/__mock/reset", (_req, res) => {
    responseConfig = { ...DEFAULT_RESPONSE };
    capturedRequests = [];
    res.json({ ok: true });
  });

  app.get("/__mock/requests", (_req, res) => {
    res.json(capturedRequests);
  });

  app.use((req, res) => {
    capturedRequests.push({
      method: req.method,
      path: req.path,
      body: req.body,
    });

    if (responseConfig.useRawBody) {
      res
        .status(responseConfig.statusCode)
        .set("Content-Type", responseConfig.contentType)
        .send(responseConfig.rawBody);
    } else {
      res.status(responseConfig.statusCode).json(responseConfig.body);
    }
  });

  return app;
}

let serverInstance = null;

function start(port = 8085) {
  return new Promise((resolve, reject) => {
    const app = createApp();
    serverInstance = app.listen(port, "127.0.0.1", () => {
      console.log(`Mock downstream server running on port ${port}`);
      resolve(serverInstance);
    });
    serverInstance.on("error", reject);
  });
}

function stop() {
  return new Promise((resolve) => {
    if (serverInstance) {
      serverInstance.close(() => {
        serverInstance = null;
        resolve();
      });
    } else {
      resolve();
    }
  });
}

module.exports = { start, stop };
