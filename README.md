# CARD.AI — 배포 가이드

## 전체 구조
```
사용자 → Vercel (Next.js 없는 정적 + Serverless)
              ↓
         Supabase (Auth + DB)
              ↓
         Anthropic API (카드뉴스 생성)
```

---

## 1단계: Supabase 설정

### 1-1. 프로젝트 생성
1. [supabase.com](https://supabase.com) 접속 → New Project
2. 프로젝트명: `cardai` / 비밀번호 설정 / 지역: Northeast Asia (Seoul)

### 1-2. DB 스키마 적용
1. Supabase 대시보드 → SQL Editor
2. `supabase/schema.sql` 전체 복사 → 붙여넣기 → Run

### 1-3. 이메일 인증 설정 (선택)
- Authentication → Providers → Email → "Confirm email" 활성화

### 1-4. API 키 확인
- Settings → API
  - `Project URL` → SUPABASE_URL
  - `anon public` → 프론트엔드 코드에 직접 입력
  - `service_role` → 환경변수로 저장 (노출 금지!)

---

## 2단계: 프론트엔드 설정

`public/index.html` 파일에서 아래 두 줄 수정:

```javascript
const SUPABASE_URL  = 'https://YOUR_PROJECT.supabase.co'; // ← 실제 URL
const SUPABASE_ANON = 'YOUR_ANON_KEY';                     // ← anon key
```

---

## 3단계: GitHub 업로드

1. [github.com](https://github.com) → New repository → `cardai`
2. 이 폴더 파일 전체 업로드 (또는 git push)

---

## 4단계: Vercel 배포

1. [vercel.com](https://vercel.com) → New Project → GitHub 저장소 선택
2. Framework: **Other**
3. **Environment Variables** 등록:

| 변수명 | 값 |
|---|---|
| `ANTHROPIC_API_KEY` | Anthropic Console에서 발급 |
| `SUPABASE_URL` | Supabase Project URL |
| `SUPABASE_SERVICE_ROLE_KEY` | Supabase service_role key |
| `GOOGLE_AI_KEY` | Google AI Studio (선택) |

4. Deploy → 완료!

---

## 5단계: 도메인 연결

- Vercel → Settings → Domains → `cardai.kr` 입력
- 도메인 업체 DNS 설정: CNAME → `cname.vercel-dns.com`

---

## 완료 후 작동 흐름

```
1. 랜딩페이지(landing.html) 방문
2. "무료로 시작하기" 클릭 → index.html(앱)으로 이동
3. 회원가입 → Supabase Auth에 저장
4. 로그인 → JWT 토큰 발급
5. 카드뉴스 생성 → /api/generate (Anthropic 호출)
6. 생성 완료 → /api/usage-increment (Supabase DB +1)
7. 사용량 한도 초과 → 업그레이드 안내
```

---

## 다음 단계 (유료 결제)
- 토스페이먼츠 연동 → 결제 완료 시 Supabase plan 업데이트
- `/api/update-plan.js` 추가 예정
