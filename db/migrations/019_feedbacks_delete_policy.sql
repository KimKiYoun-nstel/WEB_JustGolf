-- Feedbacks RLS 정책: 작성자 또는 관리자만 삭제 가능
-- Migration: 2026-02-11

-- Feedbacks 테이블의 RLS 활성화 (이미 활성화되어 있을 수 있음)
ALTER TABLE public.feedbacks ENABLE ROW LEVEL SECURITY;

-- 기존 정책 제거 (있으면)
DROP POLICY IF EXISTS "feedbacks_delete_own" ON public.feedbacks;

-- 새 정책: 작성자 또는 관리자만 삭제 가능
CREATE POLICY "feedbacks_delete_own"
ON public.feedbacks FOR DELETE
USING (
  auth.uid() = user_id
  OR public.is_admin(auth.uid())
);

-- 편의상 SELECT, INSERT 정책도 명시적으로 구성
DROP POLICY IF EXISTS "feedbacks_select_all" ON public.feedbacks;
CREATE POLICY "feedbacks_select_all"
ON public.feedbacks FOR SELECT
USING (true);

DROP POLICY IF EXISTS "feedbacks_insert_own" ON public.feedbacks;
CREATE POLICY "feedbacks_insert_own"
ON public.feedbacks FOR INSERT
WITH CHECK (auth.uid() = user_id);

-- 상태 업데이트는 관리자만
DROP POLICY IF EXISTS "feedbacks_update_admin" ON public.feedbacks;
CREATE POLICY "feedbacks_update_admin"
ON public.feedbacks FOR UPDATE
USING (public.is_admin(auth.uid()))
WITH CHECK (public.is_admin(auth.uid()));
