-- 달콧 별장 시스템 Phase 3: 예약 테이블
-- 실행 환경: Supabase SQL Editor
-- 의존성: 042_dalkkot_villas.sql 실행 후 진행

-- 1. btree_gist 확장 (날짜 범위 EXCLUDE 제약에 필요)
CREATE EXTENSION IF NOT EXISTS btree_gist;

-- 2. 예약 테이블
CREATE TABLE IF NOT EXISTS public.dalkkot_reservations (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  villa_id        UUID NOT NULL REFERENCES public.dalkkot_villas(id) ON DELETE CASCADE,
  -- 예약자 (마이그레이션된 이전 데이터는 user_id = NULL)
  user_id         UUID REFERENCES auth.users(id) ON DELETE SET NULL,

  -- 캘린더 공개 필드
  nickname        TEXT NOT NULL,
  check_in        DATE NOT NULL,
  check_out       DATE NOT NULL,
  color           TEXT NOT NULL DEFAULT '#4CAF50',    -- 8색 팔레트 중 자동 배정

  -- 관리자 전용 필드 (API에서 Service Role로만 반환)
  real_name       TEXT,
  phone           TEXT,
  guests          SMALLINT DEFAULT 1,
  notes           TEXT,

  -- 예약 상태
  -- pending          : 신청 완료, 관리자 검토 대기
  -- waiting_deposit  : 관리자가 입금 요청 발송
  -- confirmed        : 입금 확인, 최종 확정
  -- rejected         : 관리자 반려 (일정 불가 등)
  -- cancelled        : 신청자 본인 취소
  status          TEXT NOT NULL DEFAULT 'pending'
                    CHECK (status IN (
                      'pending',
                      'waiting_deposit',
                      'confirmed',
                      'rejected',
                      'cancelled'
                    )),

  -- 공과금 검침값 (퇴실 후 관리자 입력)
  gas_meter_in    NUMERIC(8,3),    -- m³
  gas_meter_out   NUMERIC(8,3),
  water_meter_in  NUMERIC(8,1),
  water_meter_out NUMERIC(8,1),
  elec_meter_in   NUMERIC(10,1),   -- kWh
  elec_meter_out  NUMERIC(10,1),
  meter_notes     TEXT,

  -- 마이그레이션 여부 (구글 시트 이전 데이터)
  is_migrated     BOOLEAN NOT NULL DEFAULT false,

  created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),

  CONSTRAINT chk_dalkkot_res_dates CHECK (check_out > check_in)
);

-- 3. updated_at 트리거
CREATE TRIGGER trg_dalkkot_reservations_updated_at
  BEFORE UPDATE ON public.dalkkot_reservations
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- 4. 날짜 중복 방지 EXCLUDE 제약
-- rejected/cancelled 상태는 제외 (취소된 날짜에 재예약 가능해야 함)
ALTER TABLE public.dalkkot_reservations
  ADD CONSTRAINT dalkkot_res_no_overlap
  EXCLUDE USING gist (
    villa_id WITH =,
    daterange(check_in, check_out, '[)') WITH &&
  ) WHERE (status NOT IN ('rejected', 'cancelled'));

-- 5. 인덱스
CREATE INDEX idx_dalkkot_res_villa_dates
  ON public.dalkkot_reservations(villa_id, check_in, check_out);
CREATE INDEX idx_dalkkot_res_user_id
  ON public.dalkkot_reservations(user_id);
CREATE INDEX idx_dalkkot_res_status
  ON public.dalkkot_reservations(status);

-- 6. RLS
ALTER TABLE public.dalkkot_reservations ENABLE ROW LEVEL SECURITY;

-- 승인된 사용자: 모든 예약의 공개 필드 조회 가능
-- ※ real_name, phone은 API 레벨에서 Service Role 클라이언트로만 반환
CREATE POLICY "dalkkot_res_select_approved"
  ON public.dalkkot_reservations FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM public.profiles
      WHERE id = auth.uid() AND is_approved = true
    )
  );

-- 본인 예약 생성 (user_id = 자신)
CREATE POLICY "dalkkot_res_insert_own"
  ON public.dalkkot_reservations FOR INSERT
  WITH CHECK (auth.uid() = user_id);

-- 본인은 pending/waiting_deposit 상태의 예약을 cancelled로만 변경 가능
CREATE POLICY "dalkkot_res_cancel_own"
  ON public.dalkkot_reservations FOR UPDATE
  USING (
    auth.uid() = user_id
    AND status IN ('pending', 'waiting_deposit')
  )
  WITH CHECK (
    auth.uid() = user_id
    AND status = 'cancelled'
  );

-- 달콧 관리자: 전체 수정 (상태 변경, 검침값 입력 등)
CREATE POLICY "dalkkot_res_update_admin"
  ON public.dalkkot_reservations FOR UPDATE
  USING (public.is_dalkkot_admin());

-- 달콧 관리자: 마이그레이션 데이터 삽입 (user_id=NULL 허용)
-- ※ 일반 INSERT는 user_id = auth.uid() 강제이므로 마이그레이션은 Service Role API만 사용
