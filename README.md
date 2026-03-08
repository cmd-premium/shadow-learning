# Key server (one key = one device)

This server makes each access key usable on **only one device**. If Anthony shares his key with someone else, the other person will see: *"This key is already in use on another device."*

## Run locally

```bash
cd key-server
node server.js
```

Server runs at `http://localhost:3030`.

## Use with your site

1. In `script.js`, set:
   ```js
   var KEY_SERVER_URL = "http://localhost:3030/check-key";
   ```
2. If you deploy this server (see below), use that URL instead of localhost.

## Deploy (so it works for everyone)

Deploy this folder to a free host so the server is always on:

- **Railway** – Connect GitHub, deploy this folder, copy the public URL and set `KEY_SERVER_URL` to `https://your-app.railway.app/check-key`.
- **Render** – New Web Service, connect repo, root directory `key-server`, start command `node server.js`, then use the Render URL + `/check-key`.
- **Fly.io** – `fly launch` in this folder, then `fly deploy`; use `https://your-app.fly.dev/check-key`.

After deploy, set `KEY_SERVER_URL` in `script.js` to your deployed URL + `/check-key`.

## Add or change keys

Edit `VALID_KEY_HASHES` in `server.js`. Hashes must match `script.js` (run `hashKey("yourkey")` in the browser console on your site to get the hash). To add a new key, add its hash to both `script.js` (ACCESS_KEY_HASHES) and `server.js` (VALID_KEY_HASHES).
