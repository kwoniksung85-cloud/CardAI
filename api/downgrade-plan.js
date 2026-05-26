// api/downgrade-plan.js
// 플랜 다운그레이드 통합 엔드포인트
//   { targetPlan: 'free' }                    → 즉시 무료 전환 (구독 해지)
//   { targetPlan: 'standard', scheduled: true } → 다음 결제일에 스탠다드 예약
//   { cancelSchedule: true }                  → 예약된 다운그레이드 취소

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

  const { targetPlan, scheduled, cancelSchedule } = req.body || {};

  if (!cancelSchedule && !['free', 'standard'].includes(targetPlan)) {
    return res.status(400).json({ error: '유효하지 않은 요청입니다.' });
  }

  try {
    const authRes = await fetch(`${SUPABASE_URL}/auth/v1/user`, {
      headers: { 'Authorization': `Bearer ${token}`, 'apikey': SUPABASE_SERVICE_KEY },
    });
    if (!authRes.ok) return res.status(401).json({ error: '인증 실패' });
    const user = await authRes.json();

    let update;
    if (cancelSchedule) {
      // 예약된 다운그레이드 취소
      update = { next_plan: null };
    } else if (scheduled) {
      // 다음 결제일에 적용 예약 (plan 유지, next_plan만 저장)
      update = { next_plan: targetPlan };
    } else {
      // 즉시 적용
      update = { plan: targetPlan, next_plan: null };
      if (targetPlan === 'free') {
        update.billing_key      = null;
        update.customer_key     = null;
        update.subscription_end = null;
      }
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

    res.json({ success: true });
  } catch (err) {
    console.error('downgrade-plan error:', err);
    res.status(500).json({ error: err.message });
  }
};
