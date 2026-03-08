# Log key usage to a Google Sheet

Logs go to **4 sheets** in one spreadsheet: Success logs, Fail logs, All logs, and Keys.

## 1. Create the sheet and script

1. Create a new [Google Sheet](https://sheets.google.com) (or use an existing one).
2. Add **4 sheets (tabs)** with these exact names:
   - **Success logs** – row 1: `Date` | `Device` | `Key`
   - **Fail logs** – row 1: `Date` | `Device` | `Key` | `Error`
   - **All logs** – row 1: `Date` | `Device` | `Key` | `Status`
   - **Keys** – row 1: `Key` | `Device` | `Date` (current key → device; script can add this if the sheet is empty)
3. Go to **Extensions → Apps Script**. Paste in the contents of **Code.gs** from this folder.
4. Save (Ctrl+S). **Deploy → New deployment** → **Web app**.
   - **Execute as:** Me  
   - **Who has access:** Anyone  
5. Copy the **Web app URL** (e.g. `https://script.google.com/macros/s/.../exec`).

## 2. What gets logged

- **Success logs** – Each time a valid key unlocks (date, device, key).
- **Fail logs** – Invalid key or “key already in use” (date, device, key, error message).
- **All logs** – Every attempt with status “Success” or “Fail”.
- **Keys** – One row per key: which key is associated to which device (updated when that key is used successfully).

## 3. Connect your site

**If you run server.js** (e.g. Railway):

- Set **LOG_TO_SHEET_APP_URL** on the server to the Web app URL.
- In **script.js** set **LOG_TO_SHEET_URL** to your server URL + `/log-key` (e.g. `https://your-app.up.railway.app/log-key`).

**If you host only static files:** Deploy server.js somewhere, set **LOG_TO_SHEET_APP_URL** there, and set **LOG_TO_SHEET_URL** in script.js to that server’s `/log-key` URL.
