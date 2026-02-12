-- Registrations 테이블: 대회 상태별 신청 제약
-- Q1-B: closed 상태에서 정보 수정 차단
-- Migration: 2026-02-11

-- 기존 INSERT 정책 확인 및 개선
DROP POLICY IF EXISTS "registrations_insert_own" ON public.registrations;

-- 신청 INSERT: open 상태일 때만 가능
CREATE POLICY "registrations_insert_open_only"
ON public.registrations FOR INSERT
WITH CHECK (
  auth.uid() = user_id
  AND
  -- 대회 상태가 'open'인지 확인
  (SELECT status FROM public.tournaments WHERE id = tournament_id) = 'open'
);

-- 기존 UPDATE 정책 개선
DROP POLICY IF EXISTS "registrations_update_own" ON public.registrations;

-- UPDATE: open 상태일 때만 가능 (본인)
CREATE POLICY "registrations_update_own_open"
ON public.registrations FOR UPDATE
USING (
  auth.uid() = user_id
  AND
  (SELECT status FROM public.tournaments WHERE id = tournament_id) = 'open'
)
WITH CHECK (
  auth.uid() = user_id
  AND
  (SELECT status FROM public.tournaments WHERE id = tournament_id) = 'open'
);

-- 관리자는 모든 상태에서 UPDATE 가능 (확인/거부 등)
DROP POLICY IF EXISTS "registrations_admin_update" ON public.registrations;
CREATE POLICY "registrations_admin_update"
ON public.registrations FOR UPDATE
USING (public.is_admin(auth.uid()))
WITH CHECK (public.is_admin(auth.uid()));

-- DELETE: 본인 또는 관리자만 (상태 무관, 언제든 취소 가능)
DROP POLICY IF EXISTS "registrations_delete_own" ON public.registrations;
CREATE POLICY "registrations_delete_own"
ON public.registrations FOR DELETE
USING (
  auth.uid() = user_id
  OR public.is_admin(auth.uid())
);
