export default async function handler(req, res) {
  const { ticker } = req.query;

  if (!ticker) {
    return res.status(400).json({ error: 'ticker is required' });
  }

  const token = process.env.BRAPI_TOKEN;
  if (!token) {
    return res.status(500).json({ error: 'BRAPI_TOKEN not configured' });
  }

  try {
    const url = `https://brapi.dev/api/quote/${encodeURIComponent(ticker)}?token=${token}&fundamental=true`;
    const response = await fetch(url);
    const data = await response.json();
    res.status(response.status).json(data);
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
}
