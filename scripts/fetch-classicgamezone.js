/**
 * Fetches all game links from classicgamezone.com/games (pages 1–126)
 * and writes classicgamezone-games.json to the project root.
 * Run: node scripts/fetch-classicgamezone.js
 */

const https = require("https");
const fs = require("fs");
const path = require("path");

const BASE = "https://classicgamezone.com";
const TOTAL_PAGES = 126;
const DELAY_MS = 800;

function fetch(url) {
  return new Promise((resolve, reject) => {
    const req = https.get(url, { headers: { "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36" } }, (res) => {
      let data = "";
      res.on("data", (c) => (data += c));
      res.on("end", () => resolve(data));
    });
    req.on("error", reject);
  });
}

function extractGameLinks(html) {
  const list = [];
  const seen = new Set();
  const re = /href=["'](?:\/en)?\/games\/([^"?#]+)["']/gi;
  let m;
  while ((m = re.exec(html)) !== null) {
    const slug = m[1].replace(/\/$/, "").trim();
    if (slug && !seen.has(slug)) {
      seen.add(slug);
      const title = slug.replace(/-/g, " ").replace(/\b\w/g, (c) => c.toUpperCase());
      list.push({ title, slug, url: BASE + "/games/" + slug });
    }
  }
  return list;
}

async function main() {
  const all = [];
  const seenSlugs = new Set();

  for (let p = 1; p <= TOTAL_PAGES; p++) {
    const url = BASE + "/games?page=" + p;
    process.stdout.write("Page " + p + "/" + TOTAL_PAGES + "... ");
    try {
      const html = await fetch(url);
      const games = extractGameLinks(html);
      let added = 0;
      games.forEach((g) => {
        if (!seenSlugs.has(g.slug)) {
          seenSlugs.add(g.slug);
          all.push(g);
          added++;
        }
      });
      console.log(added + " new, total " + all.length);
    } catch (e) {
      console.log("Error: " + e.message);
    }
    if (p < TOTAL_PAGES) await new Promise((r) => setTimeout(r, DELAY_MS));
  }

  const outPath = path.join(__dirname, "..", "classicgamezone-games.json");
  let toWrite = all;
  if (all.length === 0) {
    try {
      const existing = JSON.parse(fs.readFileSync(outPath, "utf8"));
      if (Array.isArray(existing) && existing.length > 0) {
        console.log("Scrape got 0 links (site may be JS-rendered). Keeping existing " + existing.length + " games.");
        return;
      }
    } catch (e) {}
  }
  fs.writeFileSync(outPath, JSON.stringify(toWrite, null, 0), "utf8");
  console.log("Wrote " + toWrite.length + " games to " + outPath);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
