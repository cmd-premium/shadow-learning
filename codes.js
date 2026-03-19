// Vercel verify: POST { key, device } to /api/verify (api/verify.js).
// Exposes window.SHADOW_CHECK_CODE(code, deviceId) → Promise<boolean> for the key gate.
(function () {
  // If you host the frontend somewhere else (e.g. GitHub Pages) and your API is on a different origin,
  // set `window.VERIFY_API_URL = "https://YOUR-VERCEL-DOMAIN/api/verify"` before this script loads.
  var VERIFY_API_URL = (typeof window !== "undefined" && typeof window.VERIFY_API_URL === "string" && window.VERIFY_API_URL.trim())
    ? window.VERIFY_API_URL.trim()
    : "/api/verify";

  function looksValidResponse(data) {
    if (!data) return false;
    if (data.valid === true) return true;
    if (data.license_key_valid === true) return true;
    if (data.ok === true) return true;
    if (typeof data.status === "string" && data.status.toLowerCase().indexOf("valid") >= 0) return true;
    if (typeof data.result === "string" && data.result.toLowerCase().indexOf("valid") >= 0) return true;
    return false;
  }

  function checkCode(code, deviceId) {
    if (!code || typeof code !== "string") return Promise.resolve(false);
    var trimmed = code.trim().replace(/\s+/g, "");
    if (!trimmed) return Promise.resolve(false);
    var device = (typeof deviceId === "string" && deviceId.trim()) ? deviceId : (deviceId ? String(deviceId) : "unknown");

    return fetch(VERIFY_API_URL, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ key: trimmed, device: device })
    })
      .then(function (res) { return res.json(); })
      .then(function (data) { return looksValidResponse(data); })
      .catch(function () { return false; });
  }

  window.SHADOW_CHECK_CODE = checkCode;
})();
