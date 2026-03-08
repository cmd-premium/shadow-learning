/**
 * One server: serves the site (HTML/JS/CSS) + key-check API.
 * Run: node server.js  →  open http://localhost:3000
 * Set script.js KEY_SERVER_URL = "/check-key" so key check uses this server.
 */

const http = require("http");
const https = require("https");
const fs = require("fs");
const path = require("path");

const PORT = process.env.PORT || 3000;
const LOG_TO_SHEET_APP_URL = process.env.LOG_TO_SHEET_APP_URL || "";
const ROOT = __dirname;
const BINDINGS_FILE = path.join(ROOT, "bindings.json");

const VALID_KEY_HASHES = ["15a0", "16qo", "14ik", "11ki"];

const MIMES = {
  ".html": "text/html",
  ".css": "text/css",
  ".js": "application/javascript",
  ".json": "application/json",
  ".ico": "image/x-icon",
  ".png": "image/png",
  ".jpg": "image/jpeg",
  ".svg": "image/svg+xml",
  ".woff2": "font/woff2",
};

function loadBindings() {
  try {
    return JSON.parse(fs.readFileSync(BINDINGS_FILE, "utf8"));
  } catch (e) {
    return {};
  }
}

function saveBindings(obj) {
  fs.writeFileSync(BINDINGS_FILE, JSON.stringify(obj, null, 2), "utf8");
}

// Reset all key→device bindings so every code can be used on a new device.
// Set env RESET_BINDINGS=true (or 1), then restart/redeploy. Remove it after one run.
if (process.env.RESET_BINDINGS === "true" || process.env.RESET_BINDINGS === "1") {
  saveBindings({});
  console.log("Bindings reset (all codes cleared for new devices). Remove RESET_BINDINGS after this run.");
}

function serveFile(res, filePath) {
  const ext = path.extname(filePath);
  const mime = MIMES[ext] || "application/octet-stream";
  fs.readFile(filePath, (err, data) => {
    if (err) {
      res.writeHead(404, { "Content-Type": "text/plain" });
      res.end("Not found");
      return;
    }
    res.setHeader("Content-Type", mime);
    res.end(data);
  });
}

const server = http.createServer((req, res) => {
  const url = req.url.split("?")[0];

  // Key-check API
  if (url === "/check-key") {
    res.setHeader("Access-Control-Allow-Origin", "*");
    res.setHeader("Access-Control-Allow-Methods", "POST, OPTIONS");
    res.setHeader("Access-Control-Allow-Headers", "Content-Type");

    if (req.method === "OPTIONS") {
      res.writeHead(204);
      res.end();
      return;
    }

    if (req.method !== "POST") {
      res.writeHead(404, { "Content-Type": "application/json" });
      res.end(JSON.stringify({ ok: false, error: "Not found" }));
      return;
    }

    let body = "";
    req.on("data", (chunk) => { body += chunk; });
    req.on("end", () => {
      let keyHash, fingerprint;
      try {
        const data = JSON.parse(body);
        keyHash = data.keyHash;
        fingerprint = data.fingerprint;
      } catch (e) {
        res.writeHead(400, { "Content-Type": "application/json" });
        res.end(JSON.stringify({ ok: false, error: "Invalid request" }));
        return;
      }

      if (!keyHash) {
        res.writeHead(400, { "Content-Type": "application/json" });
        res.end(JSON.stringify({ ok: false, error: "Missing keyHash" }));
        return;
      }
      fingerprint = fingerprint || "unknown";

      if (VALID_KEY_HASHES.indexOf(keyHash) === -1) {
        res.writeHead(200, { "Content-Type": "application/json" });
        res.end(JSON.stringify({ ok: false, error: "Invalid key." }));
        return;
      }

      const bindings = loadBindings();
      const existing = bindings[keyHash];

      if (existing && existing !== fingerprint) {
        res.writeHead(200, { "Content-Type": "application/json" });
        res.end(JSON.stringify({
          ok: false,
          error: "This key is already in use on another device."
        }));
        return;
      }

      bindings[keyHash] = fingerprint;
      saveBindings(bindings);

      res.writeHead(200, { "Content-Type": "application/json" });
      res.end(JSON.stringify({ ok: true }));
    });
    return;
  }

  // Log key to Google Sheet (proxy so browser avoids CORS)
  if (url === "/log-key" && LOG_TO_SHEET_APP_URL) {
    res.setHeader("Access-Control-Allow-Origin", "*");
    res.setHeader("Access-Control-Allow-Methods", "POST, OPTIONS");
    res.setHeader("Access-Control-Allow-Headers", "Content-Type");
    if (req.method === "OPTIONS") {
      res.writeHead(204);
      res.end();
      return;
    }
    if (req.method !== "POST") {
      res.writeHead(404, { "Content-Type": "application/json" });
      res.end(JSON.stringify({ ok: false, error: "Not found" }));
      return;
    }
    let logBody = "";
    req.on("data", (chunk) => { logBody += chunk; });
    req.on("end", () => {
      const target = new URL(LOG_TO_SHEET_APP_URL);
      const opts = {
        hostname: target.hostname,
        port: target.port || (target.protocol === "https:" ? 443 : 80),
        path: target.pathname + target.search,
        method: "POST",
        headers: { "Content-Type": "application/json", "Content-Length": Buffer.byteLength(logBody) }
      };
      const proxy = (target.protocol === "https:" ? https : http).request(opts, (proxyRes) => {
        res.writeHead(proxyRes.statusCode || 200, { "Content-Type": "application/json" });
        let data = "";
        proxyRes.on("data", (c) => { data += c; });
        proxyRes.on("end", () => res.end(data || "{}"));
      });
      proxy.on("error", () => {
        res.writeHead(200, { "Content-Type": "application/json" });
        res.end(JSON.stringify({ ok: false, error: "Proxy error" }));
      });
      proxy.write(logBody);
      proxy.end();
    });
    return;
  }

  // Static files
  let filePath = path.join(ROOT, url === "/" ? "index.html" : url);
  if (!path.resolve(filePath).startsWith(path.resolve(ROOT))) {
    res.writeHead(403);
    res.end("Forbidden");
    return;
  }
  fs.stat(filePath, (err, stat) => {
    if (err || !stat.isFile()) {
      if (url === "/learn" || url === "/learn/") filePath = path.join(ROOT, "learn.html");
      else {
        res.writeHead(404, { "Content-Type": "text/plain" });
        res.end("Not found");
        return;
      }
    }
    serveFile(res, filePath);
  });
});

server.listen(PORT, () => {
  console.log("Server: http://localhost:" + PORT);
  console.log("  Site + /check-key (one key per device)");
  if (LOG_TO_SHEET_APP_URL) console.log("  /log-key → Google Sheet");
});
