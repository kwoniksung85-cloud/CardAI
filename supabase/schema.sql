-- ============================================
-- CARD.AI Supabase 데이터베이스 설정
-- Supabase 대시보드 → SQL Editor에서 실행하세요
-- ============================================

-- 1. 사용자 프로필 테이블
CREATE TABLE IF NOT EXISTS profiles (
  id           UUID REFERENCES auth.users(id) ON DELETE CASCADE PRIMARY KEY,
  email        TEXT,
  plan         TEXT DEFAULT 'free' CHECK (plan IN ('free', 'standard', 'pro')),
  usage_count  INTEGER DEFAULT 0,
  usage_reset  DATE DEFAULT CURRENT_DATE,
  created_at   TIMESTAMPTZ DEFAULT NOW(),
  updated_at   TIMESTAMPTZ DEFAULT NOW()
);

-- 2. 신규 가입 시 profiles 자동 생성 트리거
CREATE OR REPLACE FUNCTION handle_new_user()
RETURNS TRIGGER AS $$
BEGIN
  INSERT INTO public.profiles (id, email)
  VALUES (NEW.id, NEW.email);
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION handle_new_user();

-- 3. 월 초마다 사용량 리셋 함수
CREATE OR REPLACE FUNCTION reset_monthly_usage()
RETURNS void AS $$
BEGIN
  UPDATE profiles
  SET usage_count = 0, usage_reset = CURRENT_DATE
  WHERE usage_reset < DATE_TRUNC('month', CURRENT_DATE);
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- 4. Row Level Security (RLS) 활성화
ALTER TABLE profiles ENABLE ROW LEVEL SECURITY;

-- 본인 데이터만 조회 가능
CREATE POLICY "users_select_own" ON profiles
  FOR SELECT USING (auth.uid() = id);

-- 본인 데이터만 수정 가능
CREATE POLICY "users_update_own" ON profiles
  FOR UPDATE USING (auth.uid() = id);

-- 5. updated_at 자동 갱신
CREATE OR REPLACE FUNCTION update_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER profiles_updated_at
  BEFORE UPDATE ON profiles
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();

-- ============================================
-- 마이그레이션: instagram_caption 컬럼 추가
-- generations 테이블이 이미 있는 경우 아래 실행:
ALTER TABLE generations ADD COLUMN IF NOT EXISTS instagram_caption TEXT;
-- ============================================

-- ============================================
-- 플랜별 제한값 (참고용)
-- free:     월 3회,  최대 5장
-- standard: 월 30회, 최대 10장
-- pro:      무제한,  최대 20장
-- ============================================
