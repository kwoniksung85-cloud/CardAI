// api/gemini-image.js
// Google AI 이미지 생성 프록시 (Imagen 3 → Unsplash 폴백)

module.exports = async (req, res) => {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  if (req.method === 'OPTIONS') return res.status(200).end();
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

  const apiKey = process.env.GOOGLE_AI_KEY;
  if (!apiKey) {
    return res.status(200).json({ imageUrl: null });
  }

  try {
    const { prompt, keyword } = req.body;

    // Gemini 2.5 Flash Image Generation
    const model = 'gemini-2.5-flash-image';
    const endpoint = `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${apiKey}`;
    try {
      const response = await fetch(endpoint, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          contents: [{ parts: [{ text: prompt }] }],
          generationConfig: { responseModalities: ['IMAGE', 'TEXT'] }
        }),
      });

      if (!response.ok) {
        const errText = await response.text();
        console.error(`[gemini-image] ${model} status=${response.status}`, errText);
      } else {
        const data = await response.json();
        const parts = data?.candidates?.[0]?.content?.parts;
        if (parts) {
          for (const part of parts) {
            if (part.inlineData?.data) {
              return res.json({ imageUrl: 'data:image/png;base64,' + part.inlineData.data });
            }
          }
        }
        console.error(`[gemini-image] ${model} - no image in response`, JSON.stringify(data?.candidates?.[0]?.content));
      }
    } catch (e) {
      console.error(`[gemini-image] ${model} exception:`, e.message);
    }

    // Imagen 3 실패 시 Unsplash 폴백
    const unsplashKey = process.env.UNSPLASH_ACCESS_KEY;
    if (unsplashKey && keyword) {
      try {
        const q = encodeURIComponent(keyword.split(',')[0].trim());
        const uRes = await fetch(
          `https://api.unsplash.com/search/photos?query=${q}&per_page=1&orientation=squarish`,
          { headers: { 'Authorization': `Client-ID ${unsplashKey}` } }
        );
        if (uRes.ok) {
          const uData = await uRes.json();
          const photo = uData.results?.[0];
          if (photo?.urls?.regular) {
            return res.json({ imageUrl: photo.urls.regular });
          }
        }
      } catch (e) {
        console.error('[gemini-image] Unsplash fallback error:', e.message);
      }
    }

    res.json({ imageUrl: null });

  } catch (err) {
    console.error('[gemini-image] error:', err);
    res.status(500).json({ error: err.message, imageUrl: null });
  }
};
