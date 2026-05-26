// api/toss-config.js
// 프론트엔드에 토스페이먼츠 클라이언트 키 노출 (공개 키, 시크릿 키 아님)

module.exports = (req, res) => {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS');
  if (req.method === 'OPTIONS') return res.status(200).end();
  if (req.method !== 'GET') return res.status(405).end();
  res.json({ clientKey: process.env.TOSS_CLIENT_KEY || '' });
};
