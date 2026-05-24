// api/save-generation.js
const SUPABASE_URL = process.env.SUPABASE_URL;
const SUPABASE_SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;
const PLAN_HISTORY_LIMIT = { free: 5, standard: 100, pro: 100 };

const headers = (extra = {}) => ({
  'Authorization': `Bearer ${SUPABASE_SERVICE_KEY}`,
  'apikey': SUPABASE_SERVICE_KEY,
  'Content-Type': 'application/json',
  ...extra,
});

module.exports = async (req, res) => {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');
  if (req.method === 'OPTIONS') return res.status(200).end();
  if (req.method !== 'POST') return res.status(405).end();

  const token = req.headers.authorization?.replace('Bearer ', '');
  if (!token) return res.status(401).json({ error: '로그인이 필요합니다.' });

  try {
    const authRes = await fetch(`${SUPABASE_URL}/auth/v1/user`, {
      headers: { 'Authorization': `Bearer ${token}`, 'apikey': SUPABASE_SERVICE_KEY }
    });
    if (!authRes.ok) return res.status(401).json({ error: '인증 실패' });
    const user = await authRes.json();

    const profileRes = await fetch(
      `${SUPABASE_URL}/rest/v1/profiles?id=eq.${user.id}&select=plan`,
      { headers: headers() }
    );
    const plan = (await profileRes.json())[0]?.plan || 'free';
    const limit = PLAN_HISTORY_LIMIT[plan] ?? 5;

    const { title, thumbnailUrl, cardCount, cardsJson, imageUrlsJson, threadsText, theme, topic } = req.body;

    // 새 기록 저장
    await fetch(`${SUPABASE_URL}/rest/v1/generations`, {
      method: 'POST',
      headers: headers({ 'Prefer': 'return=minimal' }),
      body: JSON.stringify({
        user_id: user.id,
        title: title || '카드뉴스',
        thumbnail_url: thumbnailUrl || null,
        card_count: cardCount || 1,
        cards_json: cardsJson || null,
        image_urls_json: imageUrlsJson || null,
        threads_text: threadsText || null,
        theme: theme || null,
        topic: topic || null,
      }),
    });

    // 한도 초과 시 오래된 기록 삭제
    const listRes = await fetch(
      `${SUPABASE_URL}/rest/v1/generations?user_id=eq.${user.id}&order=created_at.desc&select=id`,
      { headers: headers() }
    );
    const all = await listRes.json();
    if (all.length > limit) {
      const ids = all.slice(limit).map(r => `"${r.id}"`).join(',');
      await fetch(`${SUPABASE_URL}/rest/v1/generations?id=in.(${ids})`, {
        method: 'DELETE',
        headers: headers(),
      });
    }

    res.json({ ok: true });
  } catch (err) {
    console.error('save-generation error:', err);
    res.status(500).json({ error: err.message });
  }
};
