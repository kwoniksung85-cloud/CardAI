// api/toss-billing-auth.js
// 토스페이먼츠 빌링 인증 완료 콜백: 빌링키 발급 → 최초 결제 → Supabase 플랜 업데이트

const SUPABASE_URL      = process.env.SUPABASE_URL;
const SUPABASE_SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;
const TOSS_SECRET_KEY   = process.env.TOSS_SECRET_KEY;

const PLAN_PRICE = { standard: 9900, pro: 19900 };
const PLAN_NAME  = { standard: 'CARD.AI 스탠다드 월 구독', pro: 'CARD.AI PRO 월 구독' };

function tossAuth() {
  return 'Basic ' + Buffer.from(TOSS_SECRET_KEY + ':').toString('base64');
}

module.exports = async (req, res) => {
  if (req.method !== 'GET') return res.status(405).end();

  const { authKey, customerKey, plan, userId } = req.query;

  if (!authKey || !customerKey || !plan || !userId) {
    return res.redirect('/?payment=fail&reason=' + encodeURIComponent('필수 파라미터 누락'));
  }
  if (!PLAN_PRICE[plan]) {
    return res.redirect('/?payment=fail&reason=' + encodeURIComponent('유효하지 않은 플랜'));
  }

  try {
    // 1. 빌링키 발급
    const authRes = await fetch(
      `https://api.tosspayments.com/v1/billing/authorizations/${authKey}`,
      {
        method: 'POST',
        headers: {
          'Authorization': tossAuth(),
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ customerKey }),
      }
    );
    const authData = await authRes.json();
    if (!authRes.ok) {
      console.error('빌링키 발급 실패:', authData);
      return res.redirect('/?payment=fail&reason=' + encodeURIComponent(authData.message || '빌링키 발급 실패'));
    }
    const { billingKey } = authData;

    // 2. 유저 이메일 조회 (결제 영수증용)
    const profileRes = await fetch(
      `${SUPABASE_URL}/rest/v1/profiles?id=eq.${userId}&select=email`,
      {
        headers: {
          'Authorization': `Bearer ${SUPABASE_SERVICE_KEY}`,
          'apikey': SUPABASE_SERVICE_KEY,
        }
      }
    );
    const profiles = await profileRes.json();
    const email = profiles[0]?.email || '';

    // 3. 결제 실행 (최초 1회)
    const orderId = `${plan}-${userId.replace(/-/g, '').slice(0, 12)}-${Date.now()}`;
    const chargeRes = await fetch(
      `https://api.tosspayments.com/v1/billing/${billingKey}`,
      {
        method: 'POST',
        headers: {
          'Authorization': tossAuth(),
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          customerKey,
          amount: PLAN_PRICE[plan],
          orderId,
          orderName: PLAN_NAME[plan],
          customerEmail: email,
          customerName: email.split('@')[0] || 'user',
        }),
      }
    );
    const chargeData = await chargeRes.json();
    if (!chargeRes.ok) {
      console.error('결제 실패:', chargeData);
      return res.redirect('/?payment=fail&reason=' + encodeURIComponent(chargeData.message || '결제 실패'));
    }

    // 4. Supabase 플랜 + 빌링키 저장
    const subscriptionEnd = new Date();
    subscriptionEnd.setDate(subscriptionEnd.getDate() + 30);

    await fetch(`${SUPABASE_URL}/rest/v1/profiles?id=eq.${userId}`, {
      method: 'PATCH',
      headers: {
        'Authorization': `Bearer ${SUPABASE_SERVICE_KEY}`,
        'apikey': SUPABASE_SERVICE_KEY,
        'Content-Type': 'application/json',
        'Prefer': 'return=minimal',
      },
      body: JSON.stringify({
        plan,
        billing_key: billingKey,
        customer_key: customerKey,
        subscription_end: subscriptionEnd.toISOString().split('T')[0],
      }),
    });

    return res.redirect(`/?payment=success&plan=${plan}`);

  } catch (err) {
    console.error('toss-billing-auth error:', err);
    return res.redirect('/?payment=fail&reason=' + encodeURIComponent(err.message));
  }
};
