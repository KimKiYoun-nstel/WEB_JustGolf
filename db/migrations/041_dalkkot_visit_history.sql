-- 달콧 별장 시스템 Phase 5: 예약 방문 체크 + 정산 + 히스토리 로그
-- 실행 환경: Supabase SQL Editor
-- 의존성: 039_dalkkot_reservations.sql 실행 후 진행

-- ─────────────────────────────────────────────────
-- 1. dalkkot_reservations 에 컬럼 추가
-- ─────────────────────────────────────────────────

-- 방문 상태 (예약자가 직접 체크인/체크아웃)
-- not_checked : 아직 체크인 안 함
-- checked_in  : 입장 확인됨 (현재 사용 중)
-- checked_out : 퇴실 확인됨
-- no_show     : 예약 후 미방문 (관리자 처리)
ALTER TABLE public.dalkkot_reservations
  ADD COLUMN IF NOT EXISTS visit_status TEXT NOT NULL DEFAULT 'not_checked'
    CHECK (visit_status IN ('not_checked', 'checked_in', 'checked_out', 'no_show'));

ALTER TABLE public.dalkkot_reservations
  ADD COLUMN IF NOT EXISTS checked_in_at  TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS checked_out_at TIMESTAMPTZ;

-- 정산 처리 (관리자가 완료 처리)
ALTER TABLE public.dalkkot_reservations
  ADD COLUMN IF NOT EXISTS settlement_completed BOOLEAN NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS settlement_amount     INTEGER,     -- 원 단위 (가스비 등 계산값)
  ADD COLUMN IF NOT EXISTS settlement_notes      TEXT;

-- ─────────────────────────────────────────────────
-- 2. 예약 히스토리 로그 테이블
-- ─────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.dalkkot_reservation_history (
  id             UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  reservation_id UUID NOT NULL REFERENCES public.dalkkot_reservations(id) ON DELETE CASCADE,
  -- 변경자 정보
  actor_id       UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  actor_nickname TEXT,        -- 변경 시점 닉네임 스냅샷
  actor_role     TEXT NOT NULL CHECK (actor_role IN ('user', 'admin', 'system')),
  -- 이벤트
  action_type    TEXT NOT NULL CHECK (action_type IN (
    'created',             -- 예약 생성
    'status_changed',      -- 상태 변경 (pending→waiting_deposit 등)
    'checkin',             -- 입장 체크
    'checkout',            -- 퇴실 체크
    'no_show',             -- 미방문 처리
    'meters_updated',      -- 공과금 검침값 입력
    'cancelled',           -- 취소
    'settlement_done'      -- 정산 완료
  )),
  -- 변경 전/후 스냅샷 (JSON)
  payload        JSONB,
  created_at     TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_dalkkot_history_reservation
  ON public.dalkkot_reservation_history(reservation_id, created_at DESC);
CREATE INDEX idx_dalkkot_history_actor
  ON public.dalkkot_reservation_history(actor_id);

-- ─────────────────────────────────────────────────
-- 3. 사용자별 예약 통계 VIEW (관리자 히스토리 페이지용)
-- ─────────────────────────────────────────────────
CREATE OR REPLACE VIEW public.dalkkot_user_stats AS
SELECT
  r.user_id,
  r.nickname,
  COUNT(*)                                                  AS total_count,
  COUNT(*) FILTER (WHERE r.status = 'confirmed')            AS confirmed_count,
  COUNT(*) FILTER (WHERE r.status = 'cancelled')            AS cancelled_count,
  COUNT(*) FILTER (WHERE r.visit_status = 'no_show')        AS no_show_count,
  COUNT(*) FILTER (WHERE r.settlement_completed = true)     AS settled_count,
  COUNT(*) FILTER (
    WHERE r.status = 'confirmed'
    AND r.gas_meter_out IS NULL
    AND r.check_out < CURRENT_DATE
  )                                                         AS meter_missing_count,
  MIN(r.check_in)                                           AS first_check_in,
  MAX(r.check_out)                                          AS last_check_out
FROM public.dalkkot_reservations r
WHERE r.status NOT IN ('rejected')
GROUP BY r.user_id, r.nickname
ORDER BY MAX(r.check_out) DESC NULLS LAST;

COMMENT ON VIEW public.dalkkot_user_stats IS '달콧 관리자 히스토리 페이지용 사용자별 예약 통계';

-- ─────────────────────────────────────────────────
-- 4. 현재 사용 중 확인 함수 (캘린더/홈 표시용)
-- ─────────────────────────────────────────────────
CREATE OR REPLACE FUNCTION public.dalkkot_current_occupant(villa_id_in UUID DEFAULT NULL)
RETURNS TABLE(
  reservation_id UUID,
  nickname       TEXT,
  check_in       DATE,
  check_out      DATE,
  visit_status   TEXT,
  checked_in_at  TIMESTAMPTZ
)
LANGUAGE sql STABLE SECURITY DEFINER
SET search_path = public
AS $$
  SELECT
    r.id,
    r.nickname,
    r.check_in,
    r.check_out,
    r.visit_status,
    r.checked_in_at
  FROM public.dalkkot_reservations r
  WHERE r.status = 'confirmed'
    AND r.check_in  <= CURRENT_DATE
    AND r.check_out >= CURRENT_DATE
    AND (villa_id_in IS NULL OR r.villa_id = villa_id_in)
  ORDER BY r.check_in;
$$;

-- ─────────────────────────────────────────────────
-- 5. RLS
-- ─────────────────────────────────────────────────
ALTER TABLE public.dalkkot_reservation_history ENABLE ROW LEVEL SECURITY;

-- 승인된 사용자: 자신 예약의 히스토리 조회
CREATE POLICY "dalkkot_history_select_own"
  ON public.dalkkot_reservation_history FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM public.dalkkot_reservations r
      JOIN public.profiles p ON p.id = auth.uid()
      WHERE r.id = reservation_id
        AND p.is_approved = true
        AND (r.user_id = auth.uid() OR public.is_dalkkot_admin())
    )
  );

-- 히스토리는 INSERT만 허용 (수정/삭제 불가 — 감사 로그)
CREATE POLICY "dalkkot_history_insert_system"
  ON public.dalkkot_reservation_history FOR INSERT
  WITH CHECK (true);  -- API에서 Service Role로만 삽입

-- visit_status 변경 추가 RLS (기존 039 정책에 보완)
-- 본인의 confirmed 예약에 대해 체크인/체크아웃 가능
CREATE POLICY "dalkkot_res_visit_own"
  ON public.dalkkot_reservations FOR UPDATE
  USING (
    auth.uid() = user_id
    AND status = 'confirmed'
    AND visit_status IN ('not_checked', 'checked_in')
  )
  WITH CHECK (
    auth.uid() = user_id
    AND visit_status IN ('checked_in', 'checked_out')
  );
