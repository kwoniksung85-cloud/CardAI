// api/upgrade-to-pro.js
// 스탠다드 → PRO 일할 계산 업그레이드 (기존 빌링키 사용, subscription_end 유지)

const SUPABASE_URL      = process.env.SUPABASE_URL;
const SUPABASE_SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;
const TOSS_SECRET_KEY   = process.env.TOSS_SECRET_KEY;

const STANDARD_PRICE = 9900;
const PRO_PRICE      = 19900;

function tossAuth() {
  return 'Basic ' + Buffer.from(TOSS_SECRET_KEY + ':').toString('base64');
}

module.exports = async (req, res) => {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');
  if (req.method === 'OPTIONS') return res.status(200).end();
  if (req.method !== 'POST') return res.status(405).end();

  const token = req.headers.authorization?.replace('Bearer ', '');
  if (!token) return res.status(401).json({ error: '로그인이 필요합니다.' });

  try {
    // 1. JWT 검증
    const authRes = await fetch(`${SUPABASE_URL}/auth/v1/user`, {
      headers: { 'Authorization': `Bearer ${token}`, 'apikey': SUPABASE_SERVICE_KEY },
    });
    if (!authRes.ok) return res.status(401).json({ error: '인증 실패' });
    const user = await authRes.json();

    // 2. 프로필 조회
    const profileRes = await fetch(
      `${SUPABASE_URL}/rest/v1/profiles?id=eq.${user.id}&select=*`,
      { headers: { 'Authorization': `Bearer ${SUPABASE_SERVICE_KEY}`, 'apikey': SUPABASE_SERVICE_KEY } }
    );
    const profiles = await profileRes.json();
    const profile  = profiles[0];

    if (!profile)              return res.status(404).json({ error: '프로필 없음' });
    if (profile.plan !== 'standard') return res.status(400).json({ error: '스탠다드 플랜이 아닙니다.' });
    if (!profile.billing_key)  return res.status(400).json({ error: '빌링키가 없습니다. 카드를 다시 등록해주세요.' });
    if (!profile.subscription_end) return res.status(400).json({ error: '구독 정보가 없습니다.' });

    // 3. 일할 계산
    const endDate  = new Date(profile.subscription_end);
    const now      = new Date();
    const daysLeft = Math.max(0, Math.ceil((endDate - now) / 86400000));
    const deduct   = Math.round(STANDARD_PRICE / 30 * daysLeft);
    const charge   = Math.max(0, PRO_PRICE - deduct);

    // 4. 결제 (charge > 0인 경우)
    if (charge > 0) {
      const orderId  = `pro-up-${user.id.replace(/-/g, '').slice(0, 12)}-${Date.now()}`;
      const chargeRes = await fetch(
        `https://api.tosspayments.com/v1/billing/${profile.billing_key}`,
        {
          method: 'POST',
          headers: { 'Authorization': tossAuth(), 'Content-Type': 'application/json' },
          body: JSON.stringify({
            customerKey:   profile.customer_key,
            amount:        charge,
            orderId,
            orderName:     'CARD.AI PRO 업그레이드 (일할 정산)',
            customerEmail: user.email,
            customerName:  user.email?.split('@')[0] || 'user',
          }),
        }
      );
      const chargeData = await chargeRes.json();
      if (!chargeRes.ok) {
        console.error('결제 실패:', chargeData);
        return res.status(402).json({ error: chargeData.message || '결제에 실패했습니다.' });
      }
    }

    // 5. plan = pro 업데이트 (subscription_end는 기존 값 유지)
    await fetch(`${SUPABASE_URL}/rest/v1/profiles?id=eq.${user.id}`, {
      method: 'PATCH',
      headers: {
        'Authorization': `Bearer ${SUPABASE_SERVICE_KEY}`,
        'apikey':        SUPABASE_SERVICE_KEY,
        'Content-Type':  'application/json',
        'Prefer':        'return=minimal',
      },
      body: JSON.stringify({ plan: 'pro' }),
    });

    res.json({ success: true, chargeAmount: charge });
  } catch (err) {
    console.error('upgrade-to-pro error:', err);
    res.status(500).json({ error: err.message });
  }
};
