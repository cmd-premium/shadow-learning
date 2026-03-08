# Log key usage to a Google Sheet

Each time someone enters a valid key, you can log **device** (fingerprint) and **key** to a Google Sheet.

## 1. Create the sheet and script

1. Create a new [Google Sheet](https://sheets.google.com) (or use an existing one).
2. In row 1, add headers: **Date** | **Device** | **Key**
3. Go to **Extensions → Apps Script**. Delete any sample code and paste in the contents of **Code.gs** from this folder.
4. Save (Ctrl+S). Click **Deploy → New deployment** → choose **Web app**.
   - **Execute as:** Me  
   - **Who has access:** Anyone  
5. Click **Deploy**, then copy the **Web app URL** (looks like `https://script.google.com/macros/s/.../exec`).

## 2. Connect your site

**If you run `server.js`** (e.g. locally or on Railway/Render):

- Set env var **LOG_TO_SHEET_APP_URL** to the Web app URL you copied:
  ```bash
  set LOG_TO_SHEET_APP_URL=https://script.google.com/macros/s/.../exec
  node server.js
  ```
- In **script.js** set:
  ```js
  var LOG_TO_SHEET_URL = "http://localhost:3000/log-key";   // or your deployed server URL + /log-key
  ```

**If you host only static files** (e.g. GitHub Pages) and don’t run server.js:

- You need a backend that forwards to Google (CORS blocks the browser from posting straight to Apps Script). Deploy **server.js** somewhere, set **LOG_TO_SHEET_APP_URL** on that server, and set **LOG_TO_SHEET_URL** in script.js to `https://your-server.com/log-key`.

Each successful key entry will add a row to your sheet: date, device fingerprint, and the key used.
