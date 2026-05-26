-- 토스페이먼츠 빌링 관련 컬럼 추가
-- Supabase 대시보드 > SQL Editor에서 실행하세요.

ALTER TABLE profiles ADD COLUMN IF NOT EXISTS billing_key      TEXT;
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS customer_key     TEXT;
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS subscription_end DATE;
