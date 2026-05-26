// api/generate.js
// Anthropic API 프록시 - 동적 카드뉴스 구조 시스템 프롬프트 포함

function buildSystemPrompt(cardCount) {
  let structureGuide;

  if (cardCount <= 5) {
    structureGuide = `카드 구조 (${cardCount}장):
1번 — 표지(후킹): 아래 4가지 중 하나로 반드시 시작
  · 역발상형: "이거 하지 마세요" 스타일
  · 공감형: "이런 경험 있으세요?" 스타일
  · 숫자형: "3가지만 알면 돼요" 스타일
  · 비밀형: "아무도 안 알려줬던" 스타일
2번 — 문제제기: 독자가 "나도 그랬어" 할 공감 유도
3번 — 인사이트: 반전 있는 핵심 관점 한 가지
4번 — 적용: 오늘 바로 쓸 수 있는 방법 한 가지
${cardCount}번 — CTA: "저장해두세요, 나중에 써먹어요" 류의 저장 욕구 유도 문장`;
  } else if (cardCount <= 10) {
    const insightCount = cardCount - 5;
    structureGuide = `카드 구조 (${cardCount}장):
1번 — 표지(후킹): 역발상형 / 공감형 / 숫자형 / 비밀형 중 하나로 반드시 시작
2번 — 문제제기: 독자 공감 유도
3번 — 공감: "나만 그런 게 아니었어" 느낌
4~${cardCount - 2}번 — 인사이트 ${Math.max(2, insightCount)}~3개: 정보 나열 아닌 관점·반전 위주
${cardCount - 1}번 — 적용: 오늘 바로 쓸 수 있는 실용법
${cardCount}번 — CTA: 저장 욕구 유도 문장으로 마무리`;
  } else {
    structureGuide = `카드 구조 (${cardCount}장):
1번 — 표지(후킹): 역발상형 / 공감형 / 숫자형 / 비밀형 중 하나로 반드시 시작
2번 — 문제제기: 독자 공감 유도
3번 — 공감: 독자가 "내 얘기잖아" 느낌
4~${cardCount - 4}번 — 인사이트 4~6개: 정보 나열 아닌 관점·반전 위주
${cardCount - 3}~${cardCount - 2}번 — 적용 2~3개: 오늘 바로 실행 가능한 것들
${cardCount - 1}번 — 반전 한 방: 마지막 "헉" 하는 인사이트
${cardCount}번 — CTA: 저장 욕구 유도 문장으로 마무리`;
  }

  return `당신은 인스타그램 카드뉴스 전문 기획자입니다. 카드뉴스는 정보 전달이 아니라 저장 욕구를 설계하는 콘텐츠입니다.

${structureGuide}

공통 품질 기준 (반드시 지킬 것):
- 한 카드에 핵심 메시지 1개만. 여러 정보 욱여넣기 절대 금지
- 대화체로, 딱딱하지 않게. 친구가 귓속말로 알려주는 느낌
- 타깃이 "어? 내 이야기잖아" 느낌이 들도록 구체적으로
- "당신", "여러분", "중요합니다", "필요합니다" 등 AI 티 나는 표현 절대 금지
- 제목 15자 이내, 본문 2~3줄, "~임" "~됨" "~함" 스타일 구어체`;
}

module.exports = async (req, res) => {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  if (req.method === 'OPTIONS') return res.status(200).end();
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) {
    return res.status(500).json({ error: 'API key not configured on server' });
  }

  try {
    const { cardCount, ...body } = req.body;
    const systemPrompt = buildSystemPrompt(Number(cardCount) || 7);

    const response = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': apiKey,
        'anthropic-version': '2023-06-01',
      },
      body: JSON.stringify({ ...body, system: systemPrompt }),
    });

    const data = await response.json();
    res.status(response.status).json(data);

  } catch (err) {
    console.error('Generate error:', err);
    res.status(500).json({ error: err.message });
  }
};
