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

(Use your real Apps Script Web App URL if different.)

**Give-codes page:** Customers open  
`https://shadow-learning-production.up.railway.app/give-codes`  
(or `/give-codes.html`). They enter license code **518** to get a one-time access code (624, 819, or 123) for the main site.

**Browser:** Open `/browser` (or `/browser.html`) for a tabbed browser (DuckDuckGo by default). All site traffic goes through the `/browse` proxy. **To access websites you need a proxy:** set **PROXY_URL** (or **HTTP_PROXY** / **HTTPS_PROXY**) to your proxy URL (e.g. `http://proxy.example.com:8080`). Without it, outbound requests from Railway may be blocked or fail. Run `npm install` so `http-proxy-agent` and `https-proxy-agent` are installed.
</think><｜tool▁call▁begin｜>
TodoWrite

## 4. Get your public URL

1. In Railway: your service → **Settings** → **Networking** → **Generate Domain** (or use the one already there).
2. You'll get a URL like `https://your-app.up.railway.app`. Copy it.

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
3. After the deploy has run once, **remove** the variable **RESET_BINDINGS** (or set it to **false**) so the next deploy doesn't clear bindings again.

All keys (624, 819, 518) are then unbound; the next device to use each key will get it.

---

**Quick checklist**

- [ ] Repo on GitHub
- [ ] Railway project from that repo
- [ ] `LOG_TO_SHEET_APP_URL` variable set
- [ ] Domain generated, URL copied
- [ ] `script.js` updated with your Railway URL (or `/check-key` and `/log-key` if site is on Railway)
