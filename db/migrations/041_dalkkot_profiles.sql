-- 달콧 별장 시스템 Phase 1: profiles에 달콧 관리자 컬럼 추가
-- 실행 환경: Supabase SQL Editor

-- 1. profiles에 달콧 전용 관리자 컬럼 추가
ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS is_dalkkot_admin BOOLEAN NOT NULL DEFAULT false;

-- 2. 달콧 관리자 확인 헬퍼 함수
CREATE OR REPLACE FUNCTION public.is_dalkkot_admin(uid uuid DEFAULT auth.uid())
RETURNS boolean
LANGUAGE sql STABLE SECURITY DEFINER
SET search_path = public
AS $$
  SELECT COALESCE(
    (SELECT is_dalkkot_admin FROM public.profiles WHERE id = uid),
    false
  );
$$;

COMMENT ON COLUMN public.profiles.is_dalkkot_admin IS '달콧 별장 예약 시스템 관리자 여부';
COMMENT ON FUNCTION public.is_dalkkot_admin IS '달콧 관리자 여부 확인 헬퍼 (RLS에서 사용)';
