/**
 * Rewrites git history to remove any Discord token from discord-bot/.env.example,
 * then prints the force-push command. Run from repo root: node scripts/fix-history-and-push.js
 */
const { execSync } = require("child_process");
const path = require("path");
const fs = require("fs");
const os = require("os");

const root = path.resolve(__dirname, "..");
const scriptSource = path.join(root, "scripts", "rewrite-env-history.js");
const tempScript = path.join(os.tmpdir(), "rewrite-env-history-sl.js");

if (!fs.existsSync(scriptSource)) {
  console.error("rewrite-env-history.js not found");
  process.exit(1);
}
fs.copyFileSync(scriptSource, tempScript);

process.chdir(root);

const scriptPathForCmd = tempScript.replace(/\\/g, "/");
console.log("Rewriting history (this may take a minute)...");
try {
  execSync(
    "git filter-branch -f --tree-filter \"node " + scriptPathForCmd + "\" -- --all",
    { stdio: "inherit", maxBuffer: 50 * 1024 * 1024, shell: true }
  );
  try { fs.unlinkSync(tempScript); } catch (_) {}
  console.log("\nDone. Now run:");
  console.log("  git push --force origin master");
  console.log("(or use 'main' if that's your branch name)");
} catch (e) {
  try { fs.unlinkSync(tempScript); } catch (_) {}
  console.error("Filter-branch failed:", e.message);
  process.exit(1);
}
