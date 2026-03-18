// LicenseGate verify: check any code via api.licensegate.io (product a2550).
// Exposes window.SHADOW_CHECK_CODE(code, deviceId) → Promise<boolean> for the key gate.
(function () {
  var PRODUCT_ID = "a2550";
  var VERIFY_BASE = "https://api.licensegate.io/license/" + PRODUCT_ID + "/";

  function checkCode(code, deviceId) {
    if (!code || typeof code !== "string") return Promise.resolve(false);
    var trimmed = code.trim().replace(/\s+/g, "");
    if (!trimmed) return Promise.resolve(false);
    var url = VERIFY_BASE + encodeURIComponent(trimmed) + "/verify";
    if (deviceId && typeof deviceId === "string") {
      url += "?fingerprint=" + encodeURIComponent(deviceId);
    }
    return fetch(url)
      .then(function (res) { return res.json(); })
      .then(function (data) { return data && data.valid === true; })
      .catch(function () { return false; });
  }

  window.SHADOW_CHECK_CODE = checkCode;
})();
