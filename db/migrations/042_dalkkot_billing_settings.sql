-- 달콧 별장 시스템: 공과금 단가 및 정산 계좌 설정 테이블
-- 실행 환경: Supabase SQL Editor
-- 의존성: 038_dalkkot_villas.sql 실행 후 진행

CREATE TABLE IF NOT EXISTS public.dalkkot_billing_settings (
  id           UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  villa_id     UUID REFERENCES public.dalkkot_villas(id) ON DELETE CASCADE,

  -- 공과금 단가 (원/m³, 원/kWh)
  gas_rate     NUMERIC(10, 2) NOT NULL DEFAULT 0,   -- 가스 원/m³
  water_rate   NUMERIC(10, 2) NOT NULL DEFAULT 0,   -- 수도 원/m³
  elec_rate    NUMERIC(10, 2) NOT NULL DEFAULT 0,   -- 전기 원/kWh

  -- 정산 계좌
  bank_name    TEXT,          -- 은행명
  bank_account TEXT,          -- 계좌번호
  bank_holder  TEXT,          -- 예금주

  -- 메모 (단가 근거 등)
  notes        TEXT,

  updated_at   TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_by   UUID REFERENCES auth.users(id)
);

-- 빌라당 하나의 설정만 허용
CREATE UNIQUE INDEX IF NOT EXISTS dalkkot_billing_settings_villa_uniq
  ON public.dalkkot_billing_settings(villa_id);

-- RLS
ALTER TABLE public.dalkkot_billing_settings ENABLE ROW LEVEL SECURITY;

-- 승인된 사용자: 조회 가능 (체크아웃 시 정산 안내에 필요)
CREATE POLICY "dalkkot_billing_select_approved"
  ON public.dalkkot_billing_settings FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM public.profiles
      WHERE id = auth.uid() AND is_approved = true
    )
  );

-- 달콧 관리자: 수정 가능
CREATE POLICY "dalkkot_billing_all_admin"
  ON public.dalkkot_billing_settings FOR ALL
  USING (public.is_dalkkot_admin())
  WITH CHECK (public.is_dalkkot_admin());
