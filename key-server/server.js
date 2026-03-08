/**
 * Key server: binds each key to ONE device (stops "share my code").
 * Deploy to Railway, Render, Fly.io, or run locally and expose with ngrok.
 *
 * 1. Set KEY_SERVER_URL in script.js to this server's URL + /check-key
 * 2. Run: npm install && node server.js
 * 3. Server runs on port 3030 (or PORT env). POST /check-key with JSON:
 *    { "keyHash": "15a0", "fingerprint": "abc123" }
 *    Returns: { "ok": true } or { "ok": false, "error": "This key is already in use on another device." }
 */

const http = require("http");
const fs = require("fs");
const path = require("path");

const PORT = process.env.PORT || 3030;
const BINDINGS_FILE = path.join(__dirname, "bindings.json");

// Same hashes as in script.js: hashKey("624") = "15a0", hashKey("819") = "16qo"
const VALID_KEY_HASHES = ["15a0", "16qo", "14ik", "11ki"];

function loadBindings() {
  try {
    const data = fs.readFileSync(BINDINGS_FILE, "utf8");
    return JSON.parse(data);
  } catch (e) {
    return {};
  }
}

function saveBindings(obj) {
  fs.writeFileSync(BINDINGS_FILE, JSON.stringify(obj, null, 2), "utf8");
}

const server = http.createServer((req, res) => {
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Methods", "POST, OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type");

  if (req.method === "OPTIONS") {
    res.writeHead(204);
    res.end();
    return;
  }

  if (req.method !== "POST" || req.url !== "/check-key") {
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

    if (!keyHash || !fingerprint) {
      res.writeHead(400, { "Content-Type": "application/json" });
      res.end(JSON.stringify({ ok: false, error: "Missing keyHash or fingerprint" }));
      return;
    }

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
});

server.listen(PORT, () => {
  console.log("Key server running at http://localhost:" + PORT + " — POST /check-key");
});
