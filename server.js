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
const crypto = require("crypto");
const PROXY_URL = process.env.PROXY_URL || process.env.HTTP_PROXY || process.env.HTTPS_PROXY || "";
let httpsProxyAgent = null;
let httpProxyAgent = null;
if (PROXY_URL) {
  try {
    const { HttpsProxyAgent } = require("https-proxy-agent");
    const { HttpProxyAgent } = require("http-proxy-agent");
    httpsProxyAgent = new HttpsProxyAgent(PROXY_URL);
    httpProxyAgent = new HttpProxyAgent(PROXY_URL);
  } catch (e) {
    console.warn("Proxy set but proxy agents not installed. Run: npm install");
  }
}

const PORT = process.env.PORT || 3000;
const LOG_TO_SHEET_APP_URL = process.env.LOG_TO_SHEET_APP_URL || "";
const ROOT = __dirname;
const SITE_URL = (process.env.SITE_URL || "https://shadow-learning-production.up.railway.app").replace(/\/+$/, "");
const BINDINGS_FILE = path.join(ROOT, "bindings.json");
const CONSUMED_KEYS_FILE = path.join(ROOT, "consumed-keys.json");
const GIVE_CODES_ASSIGNMENTS_FILE = path.join(ROOT, "give-codes-assignments.json");
const HWID_LOG_FILE = path.join(ROOT, "hwid-log.jsonl");
// 518 = code to open give-codes page. Codes we hand out for the main site: 624, 819, 123.
const GATE_CODE_HASH = "14ik";  // hashKey("518")
const CODES_TO_GIVE = ["624", "819", "123"];
const CODE_TO_HASH = { "624": "15a0", "819": "16qo", "518": "14ik", "123": "11ki" };
const HASH_TO_CODE = { "15a0": "624", "16qo": "819", "14ik": "518", "11ki": "123" };

const VALID_KEY_HASHES = ["15a0", "16qo", "14ik", "11ki"];

function appendHwidLog(keyHash, fingerprint) {
  const code = HASH_TO_CODE[keyHash] || keyHash;
  const line = JSON.stringify({
    ts: new Date().toISOString(),
    code,
    keyHash,
    hwid: fingerprint
  }) + "\n";
  fs.appendFile(HWID_LOG_FILE, line, (err) => {
    if (err) console.error("HWID log append error:", err.message);
  });
}

function loadGiveCodesAssignments() {
  try {
    return JSON.parse(fs.readFileSync(GIVE_CODES_ASSIGNMENTS_FILE, "utf8"));
  } catch (e) {
    return {};
  }
}

function saveGiveCodesAssignments(obj) {
  fs.writeFileSync(GIVE_CODES_ASSIGNMENTS_FILE, JSON.stringify(obj, null, 2), "utf8");
}

function parseCookie(header) {
  if (!header) return {};
  const out = {};
  header.split(";").forEach((part) => {
    const i = part.indexOf("=");
    if (i === -1) return;
    const key = part.slice(0, i).trim();
    const val = part.slice(i + 1).trim();
    if (key && val) out[key] = val;
  });
  return out;
}

function getOrAssignCode(visitorId) {
  const assignments = loadGiveCodesAssignments();
  if (visitorId && assignments[visitorId]) {
    return { code: assignments[visitorId], isReturning: true };
  }
  const counts = {};
  CODES_TO_GIVE.forEach((c) => { counts[c] = 0; });
  Object.values(assignments).forEach((c) => { if (counts[c] !== undefined) counts[c]++; });
  let chosen = CODES_TO_GIVE[0];
  CODES_TO_GIVE.forEach((c) => {
    if (counts[c] < counts[chosen]) chosen = c;
  });
  const newId = visitorId || crypto.randomBytes(16).toString("hex");
  assignments[newId] = chosen;
  saveGiveCodesAssignments(assignments);
  return { code: chosen, isReturning: false, visitorId: newId };
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

function loadConsumedKeys() {
  try {
    const data = JSON.parse(fs.readFileSync(CONSUMED_KEYS_FILE, "utf8"));
    return Array.isArray(data) ? data : [];
  } catch (e) {
    return [];
  }
}

function saveConsumedKeys(arr) {
  fs.writeFileSync(CONSUMED_KEYS_FILE, JSON.stringify(Array.isArray(arr) ? arr : [], null, 2), "utf8");
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

// Classic Game Zone: in-memory cache of all games (built on first request to /api/classic-games)
let classicGamesCache = null;
let classicGamesFetching = false;

function fetchClassicGameZonePage(pageNum) {
  return new Promise((resolve, reject) => {
    const url = `https://classicgamezone.com/games?page=${pageNum}`;
    const opts = {
      hostname: "classicgamezone.com",
      path: "/games?page=" + pageNum,
      method: "GET",
      headers: { "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) Chrome/120.0.0.0" },
    };
    const req = https.request(opts, (res) => {
      let data = "";
      res.on("data", (c) => (data += c));
      res.on("end", () => resolve(data));
    });
    req.on("error", reject);
    req.setTimeout(15000, () => {
      req.destroy();
      reject(new Error("timeout"));
    });
    req.end();
  });
}

function extractGameLinksFromHtml(html) {
  const list = [];
  const seen = new Set();

  // Try __NEXT_DATA__ or similar embedded JSON first
  const nextDataMatch = html.match(/<script id="__NEXT_DATA__"[^>]*>([\s\S]*?)<\/script>/i);
  if (nextDataMatch) {
    try {
      const data = JSON.parse(nextDataMatch[1]);
      const props = data.props && data.props.pageProps;
      const games = (props && (props.games || props.initialGames || props.list)) || [];
      if (Array.isArray(games)) {
        games.forEach((g) => {
          const slug = (g && (g.slug || g.slugifiedTitle || g.id)) || "";
          if (slug && !seen.has(slug)) {
            seen.add(slug);
            const title = (g && g.title) || slug.replace(/-/g, " ").replace(/\b\w/g, (c) => c.toUpperCase());
            list.push({ title, slug, url: "https://classicgamezone.com/games/" + slug });
          }
        });
      }
    } catch (e) {}
  }

  // href="/games/slug" or href="https://classicgamezone.com/games/slug"
  const re = /href=["'](?:https?:\/\/[^/]*)?(?:\/en)?\/games\/([a-z0-9][a-z0-9-]*?)["']/gi;
  let m;
  while ((m = re.exec(html)) !== null) {
    const slug = m[1].replace(/\/$/, "").trim();
    if (slug && slug !== "page" && !seen.has(slug)) {
      seen.add(slug);
      const title = slug.replace(/-/g, " ").replace(/\b\w/g, (c) => c.toUpperCase());
      list.push({ title, slug, url: "https://classicgamezone.com/games/" + slug });
    }
  }

  // Any /games/slug pattern (broader fallback)
  const slugRe = /\/games\/([a-z0-9][a-z0-9-]{2,})/gi;
  while ((m = slugRe.exec(html)) !== null) {
    const slug = m[1].trim();
    if (slug && !seen.has(slug)) {
      seen.add(slug);
      const title = slug.replace(/-/g, " ").replace(/\b\w/g, (c) => c.toUpperCase());
      list.push({ title, slug, url: "https://classicgamezone.com/games/" + slug });
    }
  }
  return list;
}

function buildAllClassicGames() {
  if (classicGamesCache) return Promise.resolve(classicGamesCache);
  if (classicGamesFetching) {
    return new Promise((resolve) => {
      const t = setInterval(() => {
        if (classicGamesCache) {
          clearInterval(t);
          resolve(classicGamesCache);
        }
      }, 500);
    });
  }
  classicGamesFetching = true;
  const TOTAL_PAGES = 126;
  const all = [];
  const seenSlugs = new Set();

  const CLASSIC_JSON = path.join(ROOT, "classicgamezone-games.json");

  function next(page) {
    if (page > TOTAL_PAGES) {
      classicGamesFetching = false;
      classicGamesCache = all;
      if (all.length > 0) {
        try {
          fs.writeFileSync(CLASSIC_JSON, JSON.stringify(all), "utf8");
        } catch (e) {}
      }
      return Promise.resolve(all);
    }
    return fetchClassicGameZonePage(page)
      .then((html) => {
        const games = extractGameLinksFromHtml(html);
        games.forEach((g) => {
          if (!seenSlugs.has(g.slug)) {
            seenSlugs.add(g.slug);
            all.push(g);
          }
        });
        return new Promise((r) => setTimeout(r, 400)).then(() => next(page + 1));
      })
      .catch(() => next(page + 1));
  }
  return next(1);
}

// Hash license key (must match script.js hashKey) for give-codes gate
function normalizeKeyServer(s) {
  let str = String(s).trim().replace(/\s+/g, "");
  const fullwidth = "\uFF10\uFF11\uFF12\uFF13\uFF14\uFF15\uFF16\uFF17\uFF18\uFF19";
  const normal = "0123456789";
  for (let i = 0; i < fullwidth.length; i++) {
    str = str.split(fullwidth[i]).join(normal[i]);
  }
  return str;
}
function hashKeyServer(s) {
  const str = normalizeKeyServer(s);
  let h = 0;
  for (let i = 0; i < str.length; i++) {
    h = ((h << 5) - h + str.charCodeAt(i)) | 0;
  }
  return (h >>> 0).toString(36);
}

function buildGiveCodesKeyGateForm(errorMsg) {
  const err = errorMsg ? "<p style=\"color:#f87171;font-size:0.9rem;margin-top:12px\">" + errorMsg + "</p>" : "";
  return (
    "<!DOCTYPE html><html lang=\"en\"><head><meta charset=\"UTF-8\"/><meta name=\"viewport\" content=\"width=device-width,initial-scale=1.0\"/>"
    + "<title>Enter license key – Shadow Learning</title>"
    + "<link href=\"https://fonts.googleapis.com/css2?family=Outfit:wght@500;600;700&display=swap\" rel=\"stylesheet\"/>"
    + "<style>*{box-sizing:border-box}body{margin:0;min-height:100vh;font-family:\"Outfit\",system-ui,sans-serif;background:#030406;color:#f4f5f9;display:flex;align-items:center;justify-content:center;padding:24px}"
    + ".card{background:#080b10;border-radius:20px;padding:32px;max-width:380px;width:100%;box-shadow:0 0 0 1px rgba(148,163,184,0.08)}"
    + "h1{font-size:1.25rem;margin:0 0 8px 0;background:linear-gradient(135deg,#22d3ee,#a78bfa);-webkit-background-clip:text;-webkit-text-fill-color:transparent;background-clip:text}"
    + ".desc{font-size:0.9rem;color:#8b95a8;margin-bottom:20px}"
    + "input{width:100%;padding:12px 16px;font-size:1rem;border-radius:10px;border:1px solid rgba(148,163,184,0.2);background:rgba(15,23,42,0.6);color:#f4f5f9;font-family:inherit}"
    + "button{width:100%;margin-top:12px;padding:12px;font-size:1rem;font-weight:600;border:none;border-radius:10px;background:rgba(34,211,238,0.25);color:#22d3ee;cursor:pointer;font-family:inherit}"
    + "button:hover{background:rgba(34,211,238,0.4)}</style></head><body><div class=\"card\">"
    + "<h1>Enter license key</h1><p class=\"desc\">Enter your license key to view your key and unlock the site.</p>"
    + "<form method=\"post\" action=\"\">"
    + "<input type=\"text\" name=\"key\" placeholder=\"License key\" autocomplete=\"off\" required/>"
    + "<button type=\"submit\">Continue</button></form>" + err + "</div></body></html>"
  );
}

function buildGiveCodesPage(code, message, siteUrl, warning) {
  const warningBlock = warning
    ? "<p class=\"warning\" id=\"warning\">" + warning + "</p>"
    : "<p class=\"warning\" id=\"warning\" style=\"display:none\"></p>";
  return (
    "<!DOCTYPE html><html lang=\"en\"><head><meta charset=\"UTF-8\"/><meta name=\"viewport\" content=\"width=device-width,initial-scale=1.0\"/>"
    + "<title>Your license key – Shadow Learning</title>"
    + "<link href=\"https://fonts.googleapis.com/css2?family=Outfit:wght@500;600;700&display=swap\" rel=\"stylesheet\"/>"
    + "<style>*{box-sizing:border-box}body{margin:0;min-height:100vh;font-family:\"Outfit\",system-ui,sans-serif;background:#030406;color:#f4f5f9;display:flex;align-items:center;justify-content:center;padding:24px}"
    + ".card{background:#080b10;border-radius:20px;padding:32px;max-width:420px;width:100%;box-shadow:0 0 0 1px rgba(148,163,184,0.08),0 24px 48px rgba(0,0,0,0.4)}"
    + ".badge{font-size:0.75rem;font-weight:700;letter-spacing:0.12em;color:rgba(34,211,238,0.9);margin-bottom:8px}"
    + "h1{font-size:1.5rem;font-weight:700;margin:0 0 8px 0;background:linear-gradient(135deg,#22d3ee,#a78bfa);-webkit-background-clip:text;-webkit-text-fill-color:transparent;background-clip:text}"
    + ".desc{font-size:0.9rem;color:#8b95a8;margin-bottom:24px;line-height:1.5}"
    + ".code-row{display:flex;align-items:center;gap:12px;padding:14px 16px;background:rgba(15,23,42,0.6);border-radius:12px;margin-bottom:10px;border:1px solid rgba(148,163,184,0.08)}"
    + ".code-value{flex:1;font-size:1.1rem;font-weight:600;letter-spacing:0.08em}"
    + ".copy-btn{font-family:inherit;font-size:0.85rem;font-weight:600;padding:8px 14px;border:none;border-radius:10px;background:rgba(34,211,238,0.2);color:#22d3ee;cursor:pointer}"
    + ".copy-btn:hover{background:rgba(34,211,238,0.35)}.copy-btn.copied{background:rgba(34,197,94,0.25);color:#4ade80}"
    + ".foot{margin-top:20px;font-size:0.8rem;color:#64748b}.foot a{color:#22d3ee;text-decoration:none}"
    + ".cta-btn{display:inline-block;margin-top:8px;padding:12px 20px;border-radius:12px;background:rgba(167,139,250,0.25);color:#a78bfa;font-weight:600;text-decoration:none;transition:background 0.2s}.cta-btn:hover{background:rgba(167,139,250,0.4)}"
    + "</style></head><body><div class=\"card\"><p class=\"badge\">Customer</p><h1>Your license key</h1><p class=\"desc\">" + message + "</p>"
    + "<div class=\"code-row\"><span class=\"code-value\" data-code=\"" + code + "\">" + code + "</span>"
    + "<button type=\"button\" class=\"copy-btn\" data-code=\"" + code + "\">Copy</button></div>"
    + warningBlock
    + "<p class=\"foot\">Use this license key at <a href=\"" + siteUrl + "\" target=\"_blank\" rel=\"noopener noreferrer\">the site</a> to unlock. This code is for this device only.</p>"
    + "<p style=\"margin-top:16px\"><a href=\"https://bit.ly/shadowlearning\" target=\"_blank\" rel=\"noopener noreferrer\" class=\"cta-btn\">Go to Shadow Learning</a></p></div>"
    + "<script>document.querySelectorAll(\".copy-btn\").forEach(function(btn){btn.addEventListener(\"click\",function(){var c=this.getAttribute(\"data-code\");navigator.clipboard.writeText(c).then(function(){btn.textContent=\"Copied\";btn.classList.add(\"copied\");setTimeout(function(){btn.textContent=\"Copy\"},1500)})})});</script></body></html>"
  );
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
      appendHwidLog(keyHash, fingerprint);

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

  // Give-codes: GET serves the form (give-codes.html). POST: only code 518 opens; then we assign an unused code (624/819/123) for the main site.
  const pathNorm = (url || "/").replace(/\/+$/, "") || "/";
  if (pathNorm === "/give-codes") {
    if (req.method === "GET") {
      const formPath = path.join(ROOT, "give-codes.html");
      fs.readFile(formPath, "utf8", (err, data) => {
        if (err) {
          res.writeHead(200, { "Content-Type": "text/html; charset=utf-8" });
          res.end(buildGiveCodesKeyGateForm(null));
          return;
        }
        res.writeHead(200, { "Content-Type": "text/html; charset=utf-8" });
        res.end(data);
      });
      return;
    }
    if (req.method === "POST") {
      let postBody = "";
      req.on("data", (chunk) => { postBody += chunk; });
      req.on("end", () => {
        const ct = (req.headers["content-type"] || "").toLowerCase();
        const isForm = ct.includes("application/x-www-form-urlencoded") || ct.includes("application/x-www-form-urlencoded;");
        let key = "";
        if (postBody && (isForm || postBody.includes("="))) {
          const match = postBody.match(/(?:^|&)key=([^&]*)/);
          if (match) {
            try {
              key = decodeURIComponent(String(match[1]).replace(/\+/g, " ")).trim();
            } catch (e) {}
          }
        }
        try {
          if (!key) {
            res.writeHead(200, { "Content-Type": "text/html; charset=utf-8" });
            res.end(buildGiveCodesKeyGateForm("Please enter your license code."));
            return;
          }
          const keyHash = hashKeyServer(key);
          if (keyHash !== GATE_CODE_HASH) {
            res.writeHead(200, { "Content-Type": "text/html; charset=utf-8" });
            res.end(buildGiveCodesKeyGateForm("Invalid code. Use 518 to continue."));
            return;
          }
          const cookie = parseCookie(req.headers["cookie"]);
          const visitorId = (cookie && cookie.give_codes_visitor) ? cookie.give_codes_visitor : null;
          const result = getOrAssignCode(visitorId);
          const assignedCode = result.code;
          const esc = (s) => String(s).replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");
          const message = "Your access code for the website is below. This is your code for this device only.";
          const siteUrl = typeof SITE_URL === "string" ? SITE_URL : "https://shadow-learning-production.up.railway.app";
          const html = buildGiveCodesPage(esc(assignedCode), message, siteUrl, "");
          const headers = { "Content-Type": "text/html; charset=utf-8" };
          if (result.visitorId) {
            headers["Set-Cookie"] = "give_codes_visitor=" + result.visitorId + "; Path=/; Max-Age=31536000; HttpOnly; SameSite=Lax";
          }
          res.writeHead(200, headers);
          res.end(html);
        } catch (err) {
          console.error("give-codes POST error:", err);
          res.writeHead(500, { "Content-Type": "text/html; charset=utf-8" });
          res.end(buildGiveCodesKeyGateForm("Something went wrong. Please try again."));
        }
      });
      req.on("error", () => {
        res.writeHead(500, { "Content-Type": "text/html; charset=utf-8" });
        res.end(buildGiveCodesKeyGateForm("Request error. Please try again."));
      });
      return;
    }
    res.writeHead(405, { "Content-Type": "text/plain" });
    res.end("Method not allowed");
    return;
  }
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
    let gotTargetFromReferer = false;
    if (!target && req.headers["referer"]) {
      try {
        const ref = new URL(req.headers["referer"]);
        if (ref.pathname === "/browse" && ref.searchParams.get("u")) {
          target = ref.searchParams.get("u");
          gotTargetFromReferer = true;
        }
      } catch (e) {}
    }
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
    let method = req.method === "POST" ? "POST" : "GET";
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
      const useProxy = followUrl.startsWith("https") ? httpsProxyAgent : httpProxyAgent;
      const opts = {
        method: redirectCount === 0 ? method : "GET",
        headers: {
          "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
          "Accept": "text/html,application/xhtml+xml,application/xml;q=0.9,image/webp,*/*;q=0.8",
          "Accept-Language": "en-US,en;q=0.9"
        },
        timeout: 25000
      };
      if (useProxy) opts.agent = useProxy;
      if (redirectCount === 0 && method === "POST" && bodyBytes && bodyBytes.length) {
        const ct = req.headers["content-type"] || "application/x-www-form-urlencoded";
        opts.headers["Content-Type"] = ct;
        opts.headers["Content-Length"] = bodyBytes.length;
      }
      const handleResponse = (proxyRes) => {
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
      };
      const reqOpts = {
        hostname: nextUrl.hostname,
        port: nextUrl.port || (nextUrl.protocol === "https:" ? 443 : 80),
        path: nextUrl.pathname + nextUrl.search,
        ...opts
      };
      const proxyReq = useProxy
        ? nextLib.request(followUrl, opts, handleResponse)
        : nextLib.request(reqOpts, handleResponse);
      proxyReq.on("error", (e) => {
        res.writeHead(502, { "Content-Type": "text/plain" });
        const hint = !PROXY_URL ? " Set PROXY_URL (or HTTP_PROXY) in your environment to route requests through a proxy." : "";
        res.end("Could not load: " + (e.message || "error") + hint);
      });
      if (redirectCount === 0 && method === "POST" && bodyBytes && bodyBytes.length) {
        proxyReq.write(bodyBytes);
      }
      proxyReq.end();
    }

    if (method === "POST") {
      let body = [];
      req.on("data", (chunk) => body.push(chunk));
      req.on("end", () => {
        const bodyBytes = Buffer.concat(body);
        if (gotTargetFromReferer && bodyBytes.length) {
          const bodyStr = bodyBytes.toString("utf8");
          const mergeUrl = new URL(target);
          bodyStr.split("&").forEach((part) => {
            const i = part.indexOf("=");
            if (i !== -1) {
              try {
                const key = decodeURIComponent(part.slice(0, i).replace(/\+/g, " "));
                const val = decodeURIComponent(part.slice(i + 1).replace(/\+/g, " "));
                mergeUrl.searchParams.set(key, val);
              } catch (e) {}
            }
          });
          target = mergeUrl.href;
          method = "GET";
          doRequest(null);
        } else {
          doRequest(bodyBytes);
        }
      });
    } else {
      doRequest(null);
    }
    return;
  }

  // templates/give-codes.html: serve with demo values so you can open and run it in the browser
  if (url === "/templates/give-codes.html") {
    const templatePath = path.join(ROOT, "templates", "give-codes.html");
    fs.readFile(templatePath, "utf8", (err, data) => {
      if (err) {
        res.writeHead(404, { "Content-Type": "text/plain" });
        res.end("Not found");
        return;
      }
      const html = data
        .replace(/\{\{CODE\}\}/g, "624")
        .replace(/\{\{MESSAGE\}\}/g, "Your access code for the website is below. This is your code for this device only.")
        .replace(/\{\{SITE_URL\}\}/g, SITE_URL)
        .replace(/\{\{WARNING\}\}/g, "");
      res.writeHead(200, { "Content-Type": "text/html; charset=utf-8" });
      res.end(html);
    });
    return;
  }

  // Browser (DuckDuckGo + proxy + tabs)
  if (url === "/browser" || url === "/browser/") {
    serveFile(res, path.join(ROOT, "browser.html"));
    return;
  }

  // API: full Classic Game Zone list (2,266 games) — built on first request, then cached
  if (url === "/api/classic-games") {
    res.setHeader("Content-Type", "application/json");
    res.setHeader("Access-Control-Allow-Origin", "*");
    buildAllClassicGames()
      .then((list) => {
        res.writeHead(200);
        res.end(JSON.stringify(list));
      })
      .catch((e) => {
        res.writeHead(500, { "Content-Type": "application/json" });
        res.end(JSON.stringify({ error: String(e && e.message) || "Failed" }));
      });
    return;
  }

  // Static files (including other files in templates/ if you add any)
  let filePath = path.join(ROOT, url === "/" ? "index.html" : url);
  if (!path.resolve(filePath).startsWith(path.resolve(ROOT))) {
    res.writeHead(403);
    res.end("Forbidden");
    return;
  }
  fs.stat(filePath, (err, stat) => {
    if (err || !stat.isFile()) {
      if (url === "/learn" || url === "/learn/") filePath = path.join(ROOT, "learn.html");
      else if (url === "/browser.html") filePath = path.join(ROOT, "browser.html");
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
  console.log("  Site + /check-key (one key per device) + /browse (proxy) + /browser (tabs)");
  if (PROXY_URL && (httpsProxyAgent || httpProxyAgent)) console.log("  Outbound proxy: " + PROXY_URL);
  if (LOG_TO_SHEET_APP_URL) console.log("  /log-key → Google Sheet");
});
