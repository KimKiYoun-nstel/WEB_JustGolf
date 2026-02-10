-- Migration: 009_kakao_login_support.sql
-- 카카오 로그인 지원을 위한 profiles 테이블 확장

-- =========================================
-- 1. profiles 테이블에 컬럼 추가
-- =========================================

-- 전화번호 (선택 항목, 관리자만 조회 가능)
ALTER TABLE public.profiles 
ADD COLUMN IF NOT EXISTS phone text;

-- 실명 (선택 항목, 관리자만 조회 가능)
ALTER TABLE public.profiles 
ADD COLUMN IF NOT EXISTS real_name text;

-- 컬럼 코멘트 추가
COMMENT ON COLUMN public.profiles.phone IS '전화번호 (관리자와 본인만 조회 가능)';
COMMENT ON COLUMN public.profiles.real_name IS '실명 (관리자와 본인만 조회 가능)';
COMMENT ON COLUMN public.profiles.full_name IS '전체 이름 (기존 컬럼, 하위 호환성 유지)';

-- =========================================
-- 2. 헬퍼 함수: 사용자 인증 공급자 확인
-- =========================================

-- 사용자의 인증 공급자 확인 (email, kakao 등)
CREATE OR REPLACE FUNCTION public.get_auth_provider(uid uuid)
RETURNS text
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT 
    COALESCE(
      (SELECT raw_app_meta_data->>'provider' FROM auth.users WHERE id = uid),
      'email'
    )::text;
$$;

COMMENT ON FUNCTION public.get_auth_provider(uuid) IS '사용자의 인증 공급자를 반환 (email, kakao 등)';

-- 카카오 로그인 사용자인지 확인
CREATE OR REPLACE FUNCTION public.is_kakao_user(uid uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT public.get_auth_provider(uid) = 'kakao';
$$;

COMMENT ON FUNCTION public.is_kakao_user(uuid) IS '카카오 로그인 사용자인지 확인';

-- 이메일 로그인 사용자인지 확인
CREATE OR REPLACE FUNCTION public.is_email_user(uid uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT public.get_auth_provider(uid) = 'email';
$$;

COMMENT ON FUNCTION public.is_email_user(uuid) IS '이메일/비밀번호 로그인 사용자인지 확인';

-- =========================================
-- 3. RLS 정책 업데이트 (개인정보 보호)
-- =========================================

-- 기존 정책 삭제 후 재생성 (phone, real_name 보호 포함)
DROP POLICY IF EXISTS "profiles_select_own_or_admin" ON public.profiles;

-- 프로필 조회: 본인 또는 관리자만 가능
-- 단, phone과 real_name은 본인과 관리자만 볼 수 있음 (클라이언트에서 필터링)
CREATE POLICY "profiles_select_own_or_admin"
ON public.profiles FOR SELECT
USING (
  auth.uid() = id OR public.is_admin(auth.uid())
);

-- 기존 업데이트 정책 유지 (본인만 수정 가능)
DROP POLICY IF EXISTS "profiles_update_own" ON public.profiles;

CREATE POLICY "profiles_update_own"
ON public.profiles FOR UPDATE
USING (auth.uid() = id)
WITH CHECK (
  auth.uid() = id AND
  -- 관리자 권한은 본인이 수정할 수 없음 (보안)
  is_admin = (SELECT is_admin FROM public.profiles WHERE id = auth.uid())
);

-- =========================================
-- 4. 인덱스 추가 (성능 최적화)
-- =========================================

-- nickname 검색 최적화
CREATE INDEX IF NOT EXISTS idx_profiles_nickname 
ON public.profiles(nickname);

-- 관리자/승인 상태 필터링 최적화
CREATE INDEX IF NOT EXISTS idx_profiles_is_admin 
ON public.profiles(is_admin) 
WHERE is_admin = true;

CREATE INDEX IF NOT EXISTS idx_profiles_is_approved 
ON public.profiles(is_approved) 
WHERE is_approved = false;

-- =========================================
-- 5. 기존 데이터 검증 (무결성 확인)
-- =========================================

-- 닉네임이 '익명'인 사용자 수 확인 (로그용)
DO $$
DECLARE
  anonymous_count integer;
BEGIN
  SELECT COUNT(*) INTO anonymous_count 
  FROM public.profiles 
  WHERE nickname = '익명';
  
  RAISE NOTICE '익명 닉네임 사용자: % 명', anonymous_count;
END $$;

-- NULL 닉네임 방지 (기존 데이터 보정)
UPDATE public.profiles 
SET nickname = '익명' 
WHERE nickname IS NULL OR nickname = '';

-- =========================================
-- 6. Migration 완료 로그
-- =========================================

DO $$
BEGIN
  RAISE NOTICE '================================================';
  RAISE NOTICE 'Migration 009_kakao_login_support.sql 완료';
  RAISE NOTICE '================================================';
  RAISE NOTICE '추가된 컬럼:';
  RAISE NOTICE '  - profiles.phone (전화번호)';
  RAISE NOTICE '  - profiles.real_name (실명)';
  RAISE NOTICE '';
  RAISE NOTICE '추가된 함수:';
  RAISE NOTICE '  - get_auth_provider(uuid) → text';
  RAISE NOTICE '  - is_kakao_user(uuid) → boolean';
  RAISE NOTICE '  - is_email_user(uuid) → boolean';
  RAISE NOTICE '';
  RAISE NOTICE '업데이트된 정책:';
  RAISE NOTICE '  - profiles_select_own_or_admin';
  RAISE NOTICE '  - profiles_update_own';
  RAISE NOTICE '';
  RAISE NOTICE '다음 단계:';
  RAISE NOTICE '  1. Supabase Dashboard에서 Kakao Provider 활성화';
  RAISE NOTICE '  2. 프론트엔드 코드 구현 (Phase 3)';
  RAISE NOTICE '================================================';
END $$;
