-- Tournaments 테이블: Soft Delete 지원
-- Q2-B: 대회 상태에 'deleted' 추가
-- Migration: 2026-02-11

-- Tournaments status CHECK 제약 업데이트
-- 기존 CHECK를 변경할 수 없으므로 제약 제거 후 재생성

ALTER TABLE public.tournaments
DROP CONSTRAINT IF EXISTS tournaments_status_check;

ALTER TABLE public.tournaments
ADD CONSTRAINT tournaments_status_check
CHECK (status IN ('draft', 'open', 'closed', 'done', 'deleted'));

-- SELECT 정책 업데이트: deleted 상태는 관리자만 보기
DROP POLICY IF EXISTS "tournaments_select_public" ON public.tournaments;
CREATE POLICY "tournaments_select_public"
ON public.tournaments FOR SELECT
USING (
  status != 'deleted'
  OR public.is_admin(auth.uid())
);

-- INSERT/UPDATE/DELETE: 관리자만, deleted 상태로 표시 (hard delete 아님)
DROP POLICY IF EXISTS "tournaments_write_admin" ON public.tournaments;
CREATE POLICY "tournaments_write_admin"
ON public.tournaments FOR ALL
USING (public.is_admin(auth.uid()))
WITH CHECK (public.is_admin(auth.uid()));
