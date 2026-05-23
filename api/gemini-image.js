// api/gemini-image.js
// Google AI 이미지 생성 프록시

module.exports = async (req, res) => {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  if (req.method === 'OPTIONS') return res.status(200).end();
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

  const apiKey = process.env.GOOGLE_AI_KEY;
  if (!apiKey) {
    // API 키 없으면 빈 응답 반환 (picsum 폴백 사용)
    return res.status(200).json({ imageUrl: null });
  }

  try {
    const { prompt } = req.body;

    const models = [
      'gemini-2.0-flash-exp-image-generation',
      'gemini-2.0-flash',
    ];

    for (const model of models) {
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
          console.error(`[gemini-image] model=${model} status=${response.status}`, errText);
          continue;
        }
        const data = await response.json();
        const parts = data?.candidates?.[0]?.content?.parts;

        if (parts) {
          for (const part of parts) {
            if (part.inlineData?.data) {
              return res.json({
                imageUrl: 'data:image/png;base64,' + part.inlineData.data
              });
            }
          }
        }
        console.error(`[gemini-image] model=${model} - no image in response`, JSON.stringify(data?.candidates?.[0]?.content));
      } catch (e) {
        console.error(`[gemini-image] model=${model} exception:`, e.message);
        continue;
      }
    }

    res.json({ imageUrl: null });

  } catch (err) {
    console.error('Gemini image error:', err);
    res.status(500).json({ error: err.message, imageUrl: null });
  }
};
