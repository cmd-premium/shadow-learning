# How to run the Discord bot

Your bot is already configured (token and settings are in `.env`). Do these two things:

---

## Step 1: Add the secret to Railway (one time)

So the bot can create new codes, your key server needs the same secret.

1. Go to **https://railway.app** and open your **Shadow Learning** project.
2. Click your service (the one that runs the site).
3. Open the **Variables** tab.
4. Click **New Variable**.
5. Name: `ADD_KEY_SECRET`  
   Value: `25aa75d02dbf3ff8bb8f77dfa91b09fe60c7c15130efc2d4ce01e8c162d6c365`
6. Save. Railway will redeploy automatically.

---

## Step 2: Run the bot

1. Open **Terminal** (or Command Prompt / PowerShell) in your project folder.
2. Run:

   ```
   cd discord-bot
   npm install
   npm start
   ```

3. When you see **"Bot logged in as …"**, the bot is running.
4. In Discord, users with the **Customer** role can type **!code** to get an access code (sent in a DM).

---

**To stop the bot:** Press `Ctrl+C` in the terminal.

**To run it again later:** Open terminal → `cd discord-bot` → `npm start` (no need to run `npm install` again unless you change the bot code).

---

## Run the bot on Railway (optional)

You can run the bot on Railway so it’s always on. **Put the token and other secrets only in Railway Variables** — no `.env` file in the repo.

1. In your Railway project, click **New** → **GitHub Repo** (or add a service).
2. If the repo is the same as your site: add a **second service**, set **Root Directory** to `discord-bot`, and set **Build Command** to `npm install` and **Start Command** to `npm start` (or `node index.js`).  
   If the bot is in its own repo: connect that repo and use `npm start` as the start command.
3. Open the bot service → **Variables** and add:

   | Variable            | Value |
   |---------------------|--------|
   | `DISCORD_BOT_TOKEN` | (paste your bot token from Discord Developer Portal → Bot → Reset Token) |
   | `KEY_SERVER_URL`    | `https://shadow-learning-production.up.railway.app` |
   | `ADD_KEY_SECRET`    | `25aa75d02dbf3ff8bb8f77dfa91b09fe60c7c15130efc2d4ce01e8c162d6c365` |
   | `STAFF_ROLE_NAME`   | `Customer` |

4. Deploy. The bot will use these variables and run 24/7. You never need to put the token in a file or in git.
