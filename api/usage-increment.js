// api/usage-increment.js
// 카드뉴스 생성 후 사용량 +1

const SUPABASE_URL = process.env.SUPABASE_URL;
const SUPABASE_SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;
const PLAN_MAX = { free: 3, standard: 30, pro: null }; // null = unlimited

module.exports = async (req, res) => {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');
  if (req.method === 'OPTIONS') return res.status(200).end();
  if (req.method !== 'POST') return res.status(405).end();

  const token = req.headers.authorization?.replace('Bearer ', '');
  if (!token) return res.status(401).json({ error: '로그인이 필요합니다.' });

  try {
    // 토큰 검증
    const authRes = await fetch(`${SUPABASE_URL}/auth/v1/user`, {
      headers: { 'Authorization': `Bearer ${token}`, 'apikey': SUPABASE_SERVICE_KEY }
    });
    if (!authRes.ok) return res.status(401).json({ error: '인증 실패' });
    const user = await authRes.json();

    // 현재 프로필 조회
    const profileRes = await fetch(
      `${SUPABASE_URL}/rest/v1/profiles?id=eq.${user.id}&select=plan,usage_count,usage_reset`,
      { headers: { 'Authorization': `Bearer ${SUPABASE_SERVICE_KEY}`, 'apikey': SUPABASE_SERVICE_KEY } }
    );
    const profiles = await profileRes.json();
    const profile = profiles[0];
    if (!profile) return res.status(404).json({ error: '프로필 없음' });

    // 사용량 한도 체크
    const maxUsage = PLAN_MAX[profile.plan];
    if (maxUsage !== null && profile.usage_count >= maxUsage) {
      return res.status(429).json({
        error: `이번 달 생성 횟수(${maxUsage}회)를 모두 사용했어요.`,
        code: 'USAGE_LIMIT_EXCEEDED'
      });
    }

    // 사용량 +1
    await fetch(`${SUPABASE_URL}/rest/v1/profiles?id=eq.${user.id}`, {
      method: 'PATCH',
      headers: {
        'Authorization': `Bearer ${SUPABASE_SERVICE_KEY}`,
        'apikey': SUPABASE_SERVICE_KEY,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ usage_count: profile.usage_count + 1 })
    });

    res.json({
      usage: profile.usage_count + 1,
      maxUsage: maxUsage ?? Infinity,
      plan: profile.plan
    });

  } catch (err) {
    console.error('usage-increment error:', err);
    res.status(500).json({ error: err.message });
  }
};
