# Pushing to GitHub

## One-command update

From the project folder:

```bash
npm run push
```

This adds all changes, commits with a timestamp message, and pushes to GitHub. If you want a custom message:

```bash
node scripts/push-to-github.js "Add new feature"
```

(If the repo isn’t set up yet, run `git init` and `git remote add origin https://github.com/YOUR_USERNAME/YOUR_REPO.git` first.)

---

## Auto-push after every commit

1. Create `.git/hooks/post-commit` (in your repo’s `.git/hooks` folder) with:
   ```sh
   #!/bin/sh
   git push
   ```
2. On Windows, make sure Git Bash is used for hooks (default with Git for Windows). Then every `git commit` will also push.

---

## Other options

- **VS Code / Cursor**: Install an extension like “Git Automator” or use a task that runs `npm run push` (e.g. keybinding).
- **Scheduled**: Use Windows Task Scheduler to run `npm run push` on a schedule (e.g. daily) so local changes get synced even if you forget.
