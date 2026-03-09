# Fix GitHub push blocked by secret (Discord token in history)

GitHub blocked your push because an **old commit** still has the Discord token in `discord-bot/.env.example`. You need to rewrite history so that file never contains the real token, then force-push.

## Steps (run in your project folder)

### 1. Rewrite history

In **PowerShell** or **Command Prompt**, from the project root (`UNBLOCKED V2`):

```bash
git filter-branch -f --tree-filter "node scripts/rewrite-env-history.js" -- --all
```

This goes through every commit and replaces any `DISCORD_BOT_TOKEN=...` line in `discord-bot/.env.example` with `DISCORD_BOT_TOKEN=your_bot_token_here`.

### 2. Force-push to GitHub

If your branch is **master**:

```bash
git push --force origin master
```

If your branch is **main**:

```bash
git push --force origin main
```

(Not sure? Run `git branch` and use the name with the `*`.)

### 3. (Optional) Remove the backup refs

After the push works:

```bash
rmdir /s /q .git\refs\original 2>nul
git reflog expire --expire=now --all
git gc --prune=now
```

---

**If the filter-branch command fails:** Open **Git Bash** (from Start menu or right‑click in folder → “Git Bash Here”), then run the same `git filter-branch` command from the project root.

**Important:** Your real token stays only in `discord-bot/.env` (which is gitignored). After this fix, never commit the token again.
