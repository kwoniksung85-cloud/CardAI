// api/my-generations.js
const SUPABASE_URL = process.env.SUPABASE_URL;
const SUPABASE_SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;
const PLAN_HISTORY_LIMIT = { free: 5, standard: 100, pro: 100 };

const headers = () => ({
  'Authorization': `Bearer ${SUPABASE_SERVICE_KEY}`,
  'apikey': SUPABASE_SERVICE_KEY,
});

module.exports = async (req, res) => {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');
  if (req.method === 'OPTIONS') return res.status(200).end();
  if (req.method !== 'GET') return res.status(405).end();

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

    const genRes = await fetch(
      `${SUPABASE_URL}/rest/v1/generations?user_id=eq.${user.id}&order=created_at.desc&limit=${limit}&select=id,title,thumbnail_url,card_count,created_at,cards_json,image_urls_json,threads_text,theme,topic`,
      { headers: headers() }
    );
    const generations = await genRes.json();

    res.json({ generations, plan, limit });
  } catch (err) {
    console.error('my-generations error:', err);
    res.status(500).json({ error: err.message });
  }
};
