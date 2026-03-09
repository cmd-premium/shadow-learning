/**
 * One-time script for git filter-branch: replaces any Discord token line
 * in discord-bot/.env.example with a placeholder so GitHub push succeeds.
 * Run from repo root (Git Bash or PowerShell):
 *   git filter-branch -f --tree-filter "node scripts/rewrite-env-history.js" -- --all
 */
const fs = require("fs");
const path = require("path");
const file = path.join(process.cwd(), "discord-bot", ".env.example");
const placeholder = "your_bot_token_here";
if (fs.existsSync(file)) {
  let s = fs.readFileSync(file, "utf8");
  // Replace any line like DISCORD_BOT_TOKEN=<something> with placeholder
  s = s.replace(/^(\s*DISCORD_BOT_TOKEN=).+$/m, "$1" + placeholder);
  fs.writeFileSync(file, s);
}
