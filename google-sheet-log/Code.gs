/**
 * Log key usage to this Google Sheet (device + key).
 * 
 * SETUP:
 * 1. Create a Google Sheet (or use an existing one).
 * 2. In the sheet, add a header row in row 1:  Date | Device | Key
 * 3. Extensions → Apps Script. Delete any sample code and paste this entire file.
 * 4. Save (Ctrl+S). Click Deploy → New deployment → Type: Web app.
 *    - Description: Key log
 *    - Execute as: Me
 *    - Who has access: Anyone (so your site can POST from the browser)
 * 5. Click Deploy. Copy the Web app URL.
 * 6. In your site's script.js set: LOG_TO_SHEET_URL = "that URL";
 * 
 * When someone enters a valid key, the site will POST here and a new row will be added.
 */

function doGet() {
  return ContentService.createTextOutput(JSON.stringify({ message: "Key log – use POST to log." }))
    .setMimeType(ContentService.MimeType.JSON);
}

function doPost(e) {
  try {
    var sheet = SpreadsheetApp.getActiveSpreadsheet().getActiveSheet();
    var body = e.postData && e.postData.contents ? JSON.parse(e.postData.contents) : {};
    var device = body.fingerprint || body.device || "";
    var key = body.key || "";
    var date = new Date();
    sheet.appendRow([date, device, key]);
    return ContentService.createTextOutput(JSON.stringify({ ok: true }))
      .setMimeType(ContentService.MimeType.JSON);
  } catch (err) {
    return ContentService.createTextOutput(JSON.stringify({ ok: false, error: String(err) }))
      .setMimeType(ContentService.MimeType.JSON);
  }
}
