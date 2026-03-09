# How to run the Discord bot

Your bot is only **online in Discord while the script is running**. If you close the terminal or your PC sleeps, the bot goes offline. To have it online 24/7, run it on Railway (see bottom of this file).

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

**To stop the bot:** Press `Ctrl+C` in the terminal. The bot will go offline in Discord.

---

## Run without typing npm start (Windows)

You can start the bot without opening a terminal:

1. **Double-click `start-bot.bat`**  
   Bot runs in a window and **restarts automatically** if it crashes. Leave the window open.

2. **Double-click `start-bot-silent.vbs`**  
   Bot runs **in the background** (no window). It also restarts if it crashes.

**Run the bot when Windows starts:**

1. Press `Win + R`, type `shell:startup`, press Enter (opens your Startup folder).
2. Copy `start-bot-silent.vbs` into that folder (or create a shortcut to it there).
3. Next time you log in, the bot will start in the background by itself.

To stop the bot when it’s running silently: open Task Manager, find **Node.js**, and end that task (or restart your PC).

---

## Run the bot on Render (24/7)

See **RENDER.md** in this folder for running the bot on Render so it stays online without using your PC.

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
