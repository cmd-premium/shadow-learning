/**
 * Add all changes, commit, and push to GitHub.
 * Run: node scripts/push-to-github.js
 * Or: npm run push
 * Optional: pass a commit message: node scripts/push-to-github.js "Your message"
 */

const { execSync } = require("child_process");
const path = require("path");

const scriptDir = __dirname;
const root = path.dirname(scriptDir);
const msg = process.argv[2] || "Update " + new Date().toISOString().slice(0, 19).replace("T", " ");

function run(cmd, allowFail) {
  try {
    execSync(cmd, { cwd: root, stdio: "inherit" });
    return true;
  } catch (e) {
    if (allowFail) return false;
    process.exit(e.status || 1);
  }
}

run("git add -A");
const hasChanges = run("git diff --staged --quiet", true) === false;
if (hasChanges) {
  run("git commit -m " + JSON.stringify(msg));
  run("git push");
  console.log("Pushed to GitHub.");
} else {
  console.log("No changes to commit.");
}
