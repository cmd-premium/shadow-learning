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
