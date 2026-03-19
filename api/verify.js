export default async function handler(req, res) {
    const { key, device } = req.body;
  
    const response = await fetch("https://api.keymint.dev/v1/validate", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Authorization": `Bearer ${process.env.KEYMINT_API_KEY}`
      },
      body: JSON.stringify({
        license_key: key,
        device_id: device
      })
    });
  
    const data = await response.json();
    res.json(data);
  }