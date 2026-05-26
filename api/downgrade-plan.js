// api/downgrade-plan.js
// 플랜 다운그레이드: pro→standard, pro→free, standard→free

const SUPABASE_URL         = process.env.SUPABASE_URL;
const SUPABASE_SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;

module.exports = async (req, res) => {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');
  if (req.method === 'OPTIONS') return res.status(200).end();
  if (req.method !== 'POST') return res.status(405).end();

  const token = req.headers.authorization?.replace('Bearer ', '');
  if (!token) return res.status(401).json({ error: '로그인이 필요합니다.' });

  const { targetPlan } = req.body || {};
  if (!['free', 'standard'].includes(targetPlan)) {
    return res.status(400).json({ error: '유효하지 않은 플랜입니다.' });
  }

  try {
    const authRes = await fetch(`${SUPABASE_URL}/auth/v1/user`, {
      headers: { 'Authorization': `Bearer ${token}`, 'apikey': SUPABASE_SERVICE_KEY }
    });
    if (!authRes.ok) return res.status(401).json({ error: '인증 실패' });
    const user = await authRes.json();

    // 무료로 다운그레이드 시 빌링 정보 전체 초기화
    // 스탠다드로 다운그레이드 시 플랜만 변경 (billing_key 유지)
    const update = { plan: targetPlan };
    if (targetPlan === 'free') {
      update.billing_key      = null;
      update.customer_key     = null;
      update.subscription_end = null;
    }

    await fetch(`${SUPABASE_URL}/rest/v1/profiles?id=eq.${user.id}`, {
      method: 'PATCH',
      headers: {
        'Authorization': `Bearer ${SUPABASE_SERVICE_KEY}`,
        'apikey':        SUPABASE_SERVICE_KEY,
        'Content-Type':  'application/json',
        'Prefer':        'return=minimal',
      },
      body: JSON.stringify(update),
    });

    res.json({ success: true, plan: targetPlan });
  } catch (err) {
    console.error('downgrade-plan error:', err);
    res.status(500).json({ error: err.message });
  }
};
