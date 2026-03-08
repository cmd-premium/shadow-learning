/**
 * Log key usage to 4 sheets: Success logs, Fail logs, All logs, Keys.
 *
 * SETUP:
 * 1. In your Google Sheet, create 4 sheets (tabs) with these exact names:
 *    - Success logs  (headers row 1: Date | Device | Key)
 *    - Fail logs     (headers row 1: Date | Device | Key | Error)
 *    - All logs      (headers row 1: Date | Device | Key | Status)
 *    - Keys          (headers row 1: Key | Device | Date)
 * 2. Extensions → Apps Script. Paste this code, Save, Deploy as Web app (Anyone).
 * 3. Set LOG_TO_SHEET_URL in script.js to the Web app URL (or use /log-key on your server).
 */

function doGet() {
  return ContentService.createTextOutput(JSON.stringify({ message: "Key log – use POST to log." }))
    .setMimeType(ContentService.MimeType.JSON);
}

function getSheet(name) {
  var ss = SpreadsheetApp.getActiveSpreadsheet();
  var sheet = ss.getSheetByName(name);
  if (!sheet) {
    sheet = ss.insertSheet(name);
  }
  return sheet;
}

function doPost(e) {
  try {
    var body = e.postData && e.postData.contents ? JSON.parse(e.postData.contents) : {};
    var device = body.fingerprint || body.device || "";
    var key = body.key || "";
    var status = (body.status || "success").toLowerCase();
    var errorMsg = body.error || "";
    var date = new Date();

    var successSheet = getSheet("Success logs");
    var failSheet = getSheet("Fail logs");
    var allSheet = getSheet("All logs");
    var keysSheet = getSheet("Keys");

    if (status === "success") {
      if (keysSheet.getLastRow() === 0) {
        keysSheet.appendRow(["Key", "Device", "Date"]);
      }
      successSheet.appendRow([date, device, key]);
      allSheet.appendRow([date, device, key, "Success"]);
      var keysData = keysSheet.getDataRange().getValues();
      var keyRow = -1;
      for (var i = 1; i < keysData.length; i++) {
        if (String(keysData[i][0]).trim() === String(key).trim()) {
          keyRow = i + 1;
          break;
        }
      }
      if (keyRow > 0) {
        keysSheet.getRange(keyRow, 2, keyRow, 3).setValues([[device, date]]);
      } else {
        if (keysSheet.getLastRow() === 0) {
          keysSheet.appendRow(["Key", "Device", "Date"]);
        }
        keysSheet.appendRow([key, device, date]);
      }
    } else {
      failSheet.appendRow([date, device, key, errorMsg]);
      allSheet.appendRow([date, device, key, "Fail"]);
    }

    return ContentService.createTextOutput(JSON.stringify({ ok: true }))
      .setMimeType(ContentService.MimeType.JSON);
  } catch (err) {
    return ContentService.createTextOutput(JSON.stringify({ ok: false, error: String(err) }))
      .setMimeType(ContentService.MimeType.JSON);
  }
}
