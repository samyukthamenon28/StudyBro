export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  // Expecting exactly the same Gemini POST body structure from index.html
  const { contents, generationConfig } = req.body;
  const API_KEY = process.env.GEMINI_API_KEY;

  if (!API_KEY) {
    console.error('CRITICAL: GEMINI_API_KEY environment variable is missing.');
    return res.status(500).json({ error: 'Server misconfiguration: API key is missing. Add GEMINI_API_KEY to your Vercel Project Settings.' });
  }

  try {
    const response = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key=${API_KEY}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ contents, generationConfig })
    });

    const data = await response.json();
    if (!response.ok) {
        console.error('Gemini API Error:', data);
        return res.status(response.status).json(data);
    }

    return res.status(200).json(data);
  } catch (error) {
    console.error('Server Fetch Error:', error);
    return res.status(500).json({ error: 'Internal Server Error while reaching Gemini' });
  }
}
