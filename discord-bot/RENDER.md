# Run the Discord bot on Render (24/7)

Deploy the bot to [Render](https://render.com) so it stays online. Use a **Background Worker** (not a Web Service) because the bot uses Discord's WebSocket and doesn't need to listen on a port.

## 1. Push your code to GitHub

Make sure your repo (e.g. `shadow-learning`) is on GitHub and includes the `discord-bot` folder.

## 2. Create a Background Worker on Render

1. Go to [render.com](https://render.com) and sign in (GitHub is easiest).
2. Click **Dashboard** → **New +** → **Background Worker**.
3. Connect your GitHub account if needed, then select your **repository** (e.g. `shadow-learning`).
4. Click **Connect**.

## 3. Configure the worker

1. **Name:** e.g. `shadow-learning-bot` (anything you like).
2. **Region:** Pick one close to you.
3. **Branch:** `master` or `main` (whatever you use).
4. **Root Directory:** Under Build & Deploy, set to `discord-bot`.
5. **Runtime:** `Node`.
6. **Build Command:** `npm install` (or leave blank).
7. **Start Command:** `npm start` (or `node index.js`).

## 4. Add environment variables

In the same page, open **Environment** or **Environment Variables** and add:

| Key | Value |
|-----|--------|
| `DISCORD_BOT_TOKEN` | Your bot token from [Discord Developer Portal](https://discord.com/developers/applications) → your app → Bot → Reset Token |
| `KEY_SERVER_URL` | `https://shadow-learning-production.up.railway.app` |
| `ADD_KEY_SECRET` | Same value as on your key server (e.g. `25aa75d02dbf3ff8bb8f77dfa91b09fe60c7c15130efc2d4ce01e8c162d6c365`) |
| `STAFF_ROLE_NAME` | `Customer` |

Save or add each one.

## 5. Deploy

1. Click **Create Background Worker** (or **Save** then deploy).
2. Render will build and start the bot. Watch the **Logs** tab for `Bot logged in as ...`.
3. In Discord, the bot should show as **Online** (green dot). The worker doesn't get a public URL; the bot connects out to Discord.

## 6. Free tier note

On the free plan, Background Workers may have limits or spin down after inactivity. If the bot goes offline, open the Render dashboard, open your worker, and click **Manual Deploy** → **Deploy latest commit** to start it again. Paid plans keep workers running 24/7.

## If the bot doesn't come online

- Check **Logs** in the Render dashboard for errors (e.g. missing token, wrong `KEY_SERVER_URL`).
- Confirm all four environment variables are set and that **Root Directory** is `discord-bot`.
- If you reset the bot token in Discord, update `DISCORD_BOT_TOKEN` on Render and redeploy.
