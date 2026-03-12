/**
 * Fetches all game links from classicgamezone.com using Puppeteer (handles JS-rendered list).
 * Run: npm install puppeteer && node scripts/fetch-classicgamezone-puppeteer.js
 * Writes classicgamezone-games.json to project root with all 2266+ games.
 */

const fs = require("fs");
const path = require("path");

const BASE = "https://classicgamezone.com";
const TOTAL_PAGES = parseInt(process.env.CLASSIC_PAGES || "126", 10) || 126;
const DELAY_MS = 600;
const OUT_PATH = path.join(__dirname, "..", "classicgamezone-games.json");

async function main() {
  let puppeteer;
  try {
    puppeteer = require("puppeteer");
  } catch (e) {
    console.error("Puppeteer not installed. Run: npm install puppeteer");
    process.exit(1);
  }

  const all = [];
  const seenSlugs = new Set();

  const browser = await puppeteer.launch({
    headless: true,
    args: ["--no-sandbox", "--disable-setuid-sandbox"],
  });

  try {
    const page = await browser.newPage();
    await page.setUserAgent(
      "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36"
    );
    await page.setViewport({ width: 1280, height: 800 });

    for (let p = 1; p <= TOTAL_PAGES; p++) {
      const url = BASE + "/games?page=" + p;
      process.stdout.write("Page " + p + "/" + TOTAL_PAGES + "... ");
      try {
        await page.goto(url, { waitUntil: "networkidle2", timeout: 30000 });
        await page.waitForSelector("a[href*='/games/']", { timeout: 10000 }).catch(() => null);

        const games = await page.evaluate((base) => {
          const links = document.querySelectorAll('a[href*="/games/"]');
          const list = [];
          const seen = new Set();
          links.forEach((a) => {
            const href = a.getAttribute("href") || "";
            const match = href.match(/\/games\/([^/?#]+)/);
            if (match) {
              const slug = match[1].replace(/\/$/, "").trim();
              if (slug && !seen.has(slug)) {
                seen.add(slug);
                const title = (a.textContent || slug).trim().replace(/\s+/g, " ").slice(0, 120) || slug;
                list.push({
                  title: title || slug.replace(/-/g, " ").replace(/\b\w/g, (c) => c.toUpperCase()),
                  slug,
                  url: base + "/games/" + slug,
                });
              }
            }
          });
          return list;
        }, BASE);

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
  } finally {
    await browser.close();
  }

  const toWrite = all.length > 0 ? all : [];
  if (toWrite.length === 0) {
    try {
      const existing = JSON.parse(fs.readFileSync(OUT_PATH, "utf8"));
      if (Array.isArray(existing) && existing.length > 0) {
        console.log("No games scraped. Keeping existing " + existing.length + " games.");
        return;
      }
    } catch (e) {}
  }
  fs.writeFileSync(OUT_PATH, JSON.stringify(toWrite, null, 0), "utf8");
  console.log("Wrote " + toWrite.length + " games to " + OUT_PATH);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
