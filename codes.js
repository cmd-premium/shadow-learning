// Serverless handler (Vercel etc.). Same logic runs in server.js at POST /api/validate-license.
// Set LICENSEGATE_API_KEY (or LICENSEGATE_BEARER) in env; do not commit the token.
export default async function handler(req, res) {
    const { key, device } = req.body;
  
    const response = await fetch(
      "https://api.licensegate.io/v2/licenses/validate",
      {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "Authorization": "Bearer e3b98346-7a51-4edf-834d-5b7346c3c5d6"
        },
        body: JSON.stringify({
          license_key: key,
          fingerprint: device
        })
      }
    );
  
    const data = await response.json();
    res.json(data);
  }