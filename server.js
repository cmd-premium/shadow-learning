/**
 * One server: serves the site (HTML/JS/CSS) + key-check API.
 * Run: node server.js  →  open http://localhost:3000
 * Set script.js KEY_SERVER_URL = "/check-key" so key check uses this server.
 */

const http = require("http");
const https = require("https");
const fs = require("fs");
const path = require("path");
const urlModule = require("url");

const PORT = process.env.PORT || 3000;
const LOG_TO_SHEET_APP_URL = process.env.LOG_TO_SHEET_APP_URL || "";
const ADD_KEY_SECRET = process.env.ADD_KEY_SECRET || "";
const ROOT = __dirname;
const BINDINGS_FILE = path.join(ROOT, "bindings.json");
const VALID_KEYS_FILE = path.join(ROOT, "valid-keys.json");
const BOT_COMMANDS_FILE = path.join(ROOT, "bot-commands.json");

const VALID_KEY_HASHES_BASE = ["15a0", "16qo", "14ik", "11ki"];

function normalizeKey(s) {
  let str = String(s).trim().replace(/\s+/g, "");
  const full = "\uFF10\uFF11\uFF12\uFF13\uFF14\uFF15\uFF16\uFF17\uFF18\uFF19";
  const half = "0123456789";
  for (let i = 0; i < full.length; i++) str = str.replace(new RegExp(full[i], "g"), half[i]);
  return str;
}
function hashKey(s) {
  let h = 0;
  const str = normalizeKey(s);
  for (let i = 0; i < str.length; i++) {
    h = ((h << 5) - h) + str.charCodeAt(i) | 0;
  }
  return (h >>> 0).toString(36);
}

function loadValidKeyHashes() {
  try {
    const data = JSON.parse(fs.readFileSync(VALID_KEYS_FILE, "utf8"));
    return Array.isArray(data.hashes) ? data.hashes : [];
  } catch (e) {
    return [];
  }
}
function saveValidKeyHashes(hashes) {
  fs.writeFileSync(VALID_KEYS_FILE, JSON.stringify({ hashes }, null, 2), "utf8");
}
function getAllValidKeyHashes() {
  const dynamic = loadValidKeyHashes();
  const set = new Set([...VALID_KEY_HASHES_BASE, ...dynamic]);
  return Array.from(set);
}

function loadBotCommands() {
  try {
    const data = JSON.parse(fs.readFileSync(BOT_COMMANDS_FILE, "utf8"));
    return Array.isArray(data.commands) ? data.commands : [];
  } catch (e) {
    return [];
  }
}
function saveBotCommands(commands) {
  fs.writeFileSync(BOT_COMMANDS_FILE, JSON.stringify({ commands }, null, 2), "utf8");
}

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

function resolveUrl(base, rel) {
  try {
    if (/^\s*javascript\s*:|^\s*#|^\s*data\s*:/i.test(rel.trim())) return rel;
    return new URL(rel, base).href;
  } catch (e) {
    return rel;
  }
}

function rewriteHtml(html, baseUrl) {
  const base = baseUrl.replace(/\/?$/, "/");
  const proxy = "/browse?u=";
  return html
    .replace(/\s(href)\s*=\s*["']([^"']*)["']/gi, (_, attr, val) => {
      const abs = resolveUrl(base, val);
      return abs === val ? _ : ` ${attr}="${proxy}${encodeURIComponent(abs)}"`;
    })
    .replace(/\s(src)\s*=\s*["']([^"']*)["']/gi, (_, attr, val) => {
      const abs = resolveUrl(base, val);
      return abs === val ? _ : ` ${attr}="${proxy}${encodeURIComponent(abs)}"`;
    })
    .replace(/\s(action)\s*=\s*["']([^"']*)["']/gi, (_, attr, val) => {
      const abs = resolveUrl(base, val);
      return abs === val ? _ : ` ${attr}="${proxy}${encodeURIComponent(abs)}"`;
    });
}

const server = http.createServer((req, res) => {
  const parsedUrl = urlModule.parse(req.url || "", true);
  const url = parsedUrl.pathname || "/";
  const query = parsedUrl.query || {};

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

      const validHashes = getAllValidKeyHashes();
      if (validHashes.indexOf(keyHash) === -1) {
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

  // Admin: add a new key (used by Discord bot). Requires ADD_KEY_SECRET.
  if (url === "/admin/add-key" && ADD_KEY_SECRET) {
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
      let secret, code;
      try {
        const data = JSON.parse(body);
        secret = data.secret;
        code = data.code != null ? String(data.code).trim() : "";
      } catch (e) {
        res.writeHead(400, { "Content-Type": "application/json" });
        res.end(JSON.stringify({ ok: false, error: "Invalid request" }));
        return;
      }
      if (secret !== ADD_KEY_SECRET) {
        res.writeHead(403, { "Content-Type": "application/json" });
        res.end(JSON.stringify({ ok: false, error: "Unauthorized" }));
        return;
      }
      const normalized = normalizeKey(code);
      if (!normalized) {
        res.writeHead(400, { "Content-Type": "application/json" });
        res.end(JSON.stringify({ ok: false, error: "Missing code" }));
        return;
      }
      const keyHash = hashKey(normalized);
      const hashes = loadValidKeyHashes();
      if (hashes.indexOf(keyHash) !== -1) {
        res.writeHead(200, { "Content-Type": "application/json" });
        res.end(JSON.stringify({ ok: true, code: normalized, message: "Code already registered" }));
        return;
      }
      hashes.push(keyHash);
      saveValidKeyHashes(hashes);
      res.writeHead(200, { "Content-Type": "application/json" });
      res.end(JSON.stringify({ ok: true, code: normalized }));
    });
    return;
  }

  // Bot commands: public GET (for Discord bot), protected POST (for website with secret)
  if (url === "/bot-commands") {
    res.setHeader("Access-Control-Allow-Origin", "*");
    res.setHeader("Access-Control-Allow-Methods", "GET, POST, OPTIONS");
    res.setHeader("Access-Control-Allow-Headers", "Content-Type");
    if (req.method === "OPTIONS") {
      res.writeHead(204);
      res.end();
      return;
    }
    if (req.method === "GET") {
      const commands = loadBotCommands();
      res.writeHead(200, { "Content-Type": "application/json" });
      res.end(JSON.stringify({ commands }));
      return;
    }
    if (req.method === "POST" && ADD_KEY_SECRET) {
      let body = "";
      req.on("data", (chunk) => { body += chunk; });
      req.on("end", () => {
        let secret, commands;
        try {
          const data = JSON.parse(body);
          secret = data.secret;
          commands = Array.isArray(data.commands) ? data.commands : [];
        } catch (e) {
          res.writeHead(400, { "Content-Type": "application/json" });
          res.end(JSON.stringify({ ok: false, error: "Invalid request" }));
          return;
        }
        if (secret !== ADD_KEY_SECRET) {
          res.writeHead(403, { "Content-Type": "application/json" });
          res.end(JSON.stringify({ ok: false, error: "Unauthorized" }));
          return;
        }
        saveBotCommands(commands);
        res.writeHead(200, { "Content-Type": "application/json" });
        res.end(JSON.stringify({ ok: true }));
      });
      return;
    }
    res.writeHead(404, { "Content-Type": "application/json" });
    res.end(JSON.stringify({ ok: false, error: "Not found" }));
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

  // Browse proxy: GET or POST /browse?u= or ?url= — fetches URL, follows redirects, rewrites HTML
  if (url === "/browse") {
    res.setHeader("Access-Control-Allow-Origin", "*");
    if (req.method === "OPTIONS") {
      res.writeHead(204);
      res.end();
      return;
    }
    const rawQuery = (parsedUrl.search && String(parsedUrl.search).replace(/^\?/, "")) || "";
    let target = null;
    const tryParam = (name) => {
      const re = new RegExp("(?:^|&)" + name + "=([^&]*)");
      const m = rawQuery.match(re);
      if (m) {
        try {
          const v = decodeURIComponent(m[1].replace(/\+/g, " "));
          if (/^https?:\/\//i.test(v)) return v;
        } catch (e) {}
      }
      return null;
    };
    target = tryParam("u") || tryParam("url") || tryParam("URL") || (query && (query.u || query.url || query.URL));
    if (typeof target === "string") target = target.trim();
    if (!target || !/^https?:\/\//i.test(target)) {
      res.writeHead(400, { "Content-Type": "text/plain" });
      res.end("Missing url parameter. Use /browse?u=https://example.com");
      return;
    }
    const targetUrl = new URL(target);
    Object.keys(query || {}).forEach((key) => {
      if (key !== "u" && key !== "url" && key !== "URL") targetUrl.searchParams.set(key, query[key]);
    });
    target = targetUrl.href;
    const method = req.method === "POST" ? "POST" : "GET";
    const lib = target.startsWith("https") ? https : http;
    const REDIRECT_CODES = [301, 302, 303, 307, 308];
    const MAX_REDIRECTS = 5;

    function doRequest(bodyBytes, followUrl, redirectCount) {
      followUrl = followUrl || target;
      redirectCount = redirectCount || 0;
      if (redirectCount > MAX_REDIRECTS) {
        res.writeHead(502, { "Content-Type": "text/plain" });
        res.end("Too many redirects");
        return;
      }
      const nextUrl = new URL(followUrl);
      const nextLib = followUrl.startsWith("https") ? https : http;
      const opts = {
        method: redirectCount === 0 ? method : "GET",
        headers: {
          "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
          "Accept": "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8",
          "Accept-Language": "en-US,en;q=0.9"
        },
        timeout: 15000
      };
      if (redirectCount === 0 && method === "POST" && bodyBytes && bodyBytes.length) {
        const ct = req.headers["content-type"] || "application/x-www-form-urlencoded";
        opts.headers["Content-Type"] = ct;
        opts.headers["Content-Length"] = bodyBytes.length;
      }
      const reqOpts = {
        hostname: nextUrl.hostname,
        port: nextUrl.port || (nextUrl.protocol === "https:" ? 443 : 80),
        path: nextUrl.pathname + nextUrl.search,
        ...opts
      };
      const proxyReq = nextLib.request(reqOpts, (proxyRes) => {
        if (REDIRECT_CODES.indexOf(proxyRes.statusCode) !== -1) {
          const loc = proxyRes.headers["location"];
          if (loc) {
            const resolved = new URL(loc, followUrl).href;
            if (/^https?:\/\//i.test(resolved)) {
              doRequest(null, resolved, redirectCount + 1);
              return;
            }
          }
        }
        const chunks = [];
        proxyRes.on("data", (c) => chunks.push(c));
        proxyRes.on("end", () => {
          const body = Buffer.concat(chunks);
          const ct = (proxyRes.headers["content-type"] || "").toLowerCase();
          const finalUrl = followUrl;
          if (ct.includes("text/html")) {
            const base = finalUrl.replace(/#.*$/, "").replace(/\?.*$/, "").replace(/\/[^/]*$/, "/") || finalUrl + "/";
            const rewritten = rewriteHtml(body.toString("utf8"), base);
            res.writeHead(proxyRes.statusCode || 200, { "Content-Type": "text/html; charset=utf-8" });
            res.end(rewritten);
          } else {
            res.writeHead(proxyRes.statusCode || 200, { "Content-Type": ct || "application/octet-stream" });
            res.end(body);
          }
        });
      });
      proxyReq.on("error", (e) => {
        res.writeHead(502, { "Content-Type": "text/plain" });
        res.end("Could not load: " + (e.message || "error"));
      });
      if (redirectCount === 0 && method === "POST" && bodyBytes && bodyBytes.length) {
        proxyReq.write(bodyBytes);
      }
      proxyReq.end();
    }

    if (method === "POST") {
      let body = [];
      req.on("data", (chunk) => body.push(chunk));
      req.on("end", () => doRequest(Buffer.concat(body)));
    } else {
      doRequest(null);
    }
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
  console.log("  Site + /check-key (one key per device) + /browse (proxy)");
  if (LOG_TO_SHEET_APP_URL) console.log("  /log-key → Google Sheet");
});
