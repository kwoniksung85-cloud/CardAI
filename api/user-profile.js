// api/user-profile.js
// 로그인한 유저의 플랜 + 사용량 조회

const SUPABASE_URL = process.env.SUPABASE_URL;
const SUPABASE_SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;

module.exports = async (req, res) => {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');
  if (req.method === 'OPTIONS') return res.status(200).end();
  if (req.method !== 'GET') return res.status(405).end();

  // JWT 토큰에서 유저 ID 추출
  const token = req.headers.authorization?.replace('Bearer ', '');
  if (!token) return res.status(401).json({ error: '로그인이 필요합니다.' });

  try {
    // Supabase로 토큰 검증
    const authRes = await fetch(`${SUPABASE_URL}/auth/v1/user`, {
      headers: {
        'Authorization': `Bearer ${token}`,
        'apikey': SUPABASE_SERVICE_KEY,
      }
    });

    if (!authRes.ok) return res.status(401).json({ error: '인증 실패' });
    const user = await authRes.json();

    // 프로필 조회
    const profileRes = await fetch(
      `${SUPABASE_URL}/rest/v1/profiles?id=eq.${user.id}&select=*`,
      {
        headers: {
          'Authorization': `Bearer ${SUPABASE_SERVICE_KEY}`,
          'apikey': SUPABASE_SERVICE_KEY,
        }
      }
    );

    const profiles = await profileRes.json();
    const profile = profiles[0];

    if (!profile) return res.status(404).json({ error: '프로필 없음' });

    // 월 사용량 리셋 체크
    const resetDate = new Date(profile.usage_reset);
    const now = new Date();
    const isNewMonth = resetDate.getFullYear() !== now.getFullYear() ||
                       resetDate.getMonth() !== now.getMonth();

    if (isNewMonth) {
      await fetch(`${SUPABASE_URL}/rest/v1/profiles?id=eq.${user.id}`, {
        method: 'PATCH',
        headers: {
          'Authorization': `Bearer ${SUPABASE_SERVICE_KEY}`,
          'apikey': SUPABASE_SERVICE_KEY,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ usage_count: 0, usage_reset: now.toISOString().split('T')[0] })
      });
      profile.usage_count = 0;
    }

    const PLAN_MAX = { free: 3, standard: 30, pro: Infinity };

    res.json({
      id: user.id,
      email: user.email,
      plan: profile.plan,
      usage: profile.usage_count,
      maxUsage: PLAN_MAX[profile.plan] ?? 3,
    });

  } catch (err) {
    console.error('user-profile error:', err);
    res.status(500).json({ error: err.message });
  }
};
