# Deploy to Railway

Use this to get a live URL for your site + key API + Google Sheet log.

## 1. Push your project to GitHub

1. Create a new repo on [github.com](https://github.com/new) (e.g. `shadow-learning`).
2. In your project folder:
   ```bash
   git init
   git add .
   git commit -m "Initial commit"
   git branch -M main
   git remote add origin https://github.com/YOUR_USERNAME/YOUR_REPO.git
   git push -u origin main
   ```

## 2. Create a Railway project

1. Go to [railway.app](https://railway.app) and sign in (GitHub is easiest).
2. Click **New Project** → **Deploy from GitHub repo**.
3. Choose your repo and (if asked) the **root** of the repo.
4. Railway will detect the Node app from `package.json` and run `npm start` (= `node server.js`).

## 3. Set environment variables

In the Railway dashboard: your project → your service → **Variables**.

Add:

| Variable | Value |
|----------|--------|
| `LOG_TO_SHEET_APP_URL` | Your Google Apps Script Web App URL (for key logging) |
| `ADD_KEY_SECRET` | A long random secret (e.g. `openssl rand -hex 32`). Same value goes in the Discord bot’s `.env` so it can register new codes. |

(Use your real Apps Script Web App URL if different.)

No need to set `PORT`; Railway sets it for you.

## 4. Get your public URL

1. In Railway: your service → **Settings** → **Networking** → **Generate Domain** (or use the one already there).
2. You’ll get a URL like `https://your-app.up.railway.app`. Copy it.

## 5. Point your site at Railway

**If you serve the site from Railway** (you open `https://your-app.up.railway.app`):

- In **script.js** set:
  ```js
  var KEY_SERVER_URL = "/check-key";
  var LOG_TO_SHEET_URL = "/log-key";
  ```
  Then redeploy (push to GitHub or trigger deploy in Railway). The site and APIs are on the same origin.

**If you host the site elsewhere** (e.g. GitHub Pages at `https://cmd-premium.github.io/...`):

- In **script.js** set:
  ```js
  var KEY_SERVER_URL = "https://your-app.up.railway.app/check-key";
  var LOG_TO_SHEET_URL = "https://your-app.up.railway.app/log-key";
  ```
  Replace `your-app.up.railway.app` with your real Railway domain.

  For **check-key** to work from another origin, the server already sends `Access-Control-Allow-Origin: *`, so it should work. If you see CORS errors for **log-key**, the server is set to allow that too.

## 6. Deploy

- Every `git push` to your main branch will redeploy.
- Or in Railway: **Deployments** → **Redeploy** for the latest commit.

---

## Reset all codes (new devices can use them again)

1. In Railway: your service → **Variables** → Add **RESET_BINDINGS** = **true**.
2. **Redeploy** (Deployments → Redeploy, or push a commit).
3. After the deploy has run once, **remove** the variable **RESET_BINDINGS** (or set it to **false**) so the next deploy doesn’t clear bindings again.

All keys (624, 819, 518) are then unbound; the next device to use each key will get it.

---

**Quick checklist**

- [ ] Repo on GitHub
- [ ] Railway project from that repo
- [ ] `LOG_TO_SHEET_APP_URL` variable set
- [ ] Domain generated, URL copied
- [ ] `script.js` updated with your Railway URL (or `/check-key` and `/log-key` if site is on Railway)

---

## Run the Discord bot on Railway (24/7)

So the bot stays online all the time, deploy it as a **second service** in the same Railway project.

### Step 1: Add a new service

1. Go to [railway.app](https://railway.app) and open your **Shadow Learning** project.
2. Click **+ New** (or **Add Service**).
3. Choose **GitHub Repo** and select the **same repo** you use for the site (`shadow-learning` or whatever it’s named).
4. After the service is created, click it to open its settings.

### Step 2: Use the `discord-bot` folder

1. Click the new service → **Settings** (or the **Settings** tab).
2. Find **Root Directory** (under “Build” or “Source”).
3. Click **Override** or **Add variable** and set:
   - **Root Directory:** `discord-bot`
4. Under **Build Command** (if shown): leave default or set to `npm install`.
5. Under **Start Command** (if shown): set to `npm start` or `node index.js`.
6. Save. Railway will redeploy using only the `discord-bot` folder.

### Step 3: Set the bot’s environment variables

1. With the **bot service** selected, open the **Variables** tab.
2. Click **+ New Variable** (or **Add Variable**) and add these **one by one**:

| Variable             | Value |
|----------------------|--------|
| `DISCORD_BOT_TOKEN`  | Your bot token from [Discord Developer Portal](https://discord.com/developers/applications) → your app → **Bot** → **Reset Token** (copy once) |
| `KEY_SERVER_URL`     | `https://shadow-learning-production.up.railway.app` (or your key server’s URL) |
| `ADD_KEY_SECRET`     | **Same value** as `ADD_KEY_SECRET` on your **main** (site) service — e.g. `25aa75d02dbf3ff8bb8f77dfa91b09fe60c7c15130efc2d4ce01e8c162d6c365` |
| `STAFF_ROLE_NAME`    | `Customer` (or the role name you use for people who can run `!code`) |

3. Save. Railway will redeploy with the new variables.

### Step 4: Deploy and check

1. Go to **Deployments**. The latest deployment should be building/running.
2. When it’s **Success** (green), the bot is running. Open your Discord server — the bot should show as **Online** (green dot).
3. You don’t need a public URL for the bot; it connects out to Discord. No need to “Generate Domain” for this service.

### If the bot doesn’t come online

- **Variables:** Confirm all four variables are set on the **bot service** (not the site service). No typos in names.
- **Token:** If you ever reset the token in the Discord Developer Portal, update `DISCORD_BOT_TOKEN` in Railway and redeploy.
- **Logs:** In Railway, open the bot service → **Deployments** → click the latest run → **View Logs**. Look for `Bot logged in as ...` or any error message.
