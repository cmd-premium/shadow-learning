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
    const err = e.message || String(e);
    if (err.includes("not a git repository")) {
      console.error("This folder is not a Git repository. Run: git init");
      console.error("Then: git remote add origin https://github.com/YOUR_USERNAME/YOUR_REPO.git");
    } else if (err.includes("not recognized") || err.includes("ENOENT")) {
      console.error("Git is not installed or not in your PATH.");
      console.error("Install Git: https://git-scm.com/download/win");
    }
    process.exit(e.status || 1);
  }
}

try {
  execSync("git --version", { cwd: root, stdio: "ignore" });
} catch (e) {
  console.error("Git is not installed or not in your PATH.");
  console.error("Install Git: https://git-scm.com/download/win");
  console.error("Then restart the terminal (or Cursor) and run: npm run push");
  process.exit(1);
}

try {
  execSync("git rev-parse --is-inside-work-tree", { cwd: root, stdio: "ignore" });
} catch (e) {
  console.error("This folder is not a Git repository.");
  console.error("Run these in the project folder first:");
  console.error("  git init");
  console.error("  git remote add origin https://github.com/YOUR_USERNAME/YOUR_REPO.git");
  console.error("Then run: npm run push");
  process.exit(1);
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
