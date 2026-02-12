-- 028_side_event_registration_by_registration.sql
-- Purpose:
--   1) 사전/사후 라운드 신청을 본대회 registration 단위로 연결
--   2) 제3자(user_id IS NULL) 참가자도 라운드 신청 가능하도록 확장

-- ============================================================================
-- 1) side_event_registrations 구조 확장
-- ============================================================================

ALTER TABLE public.side_event_registrations
  ADD COLUMN IF NOT EXISTS registration_id bigint REFERENCES public.registrations(id) ON DELETE CASCADE;

-- 기존 데이터 백필:
-- 기존 row는 (side_event_id, user_id)만 있으므로
-- side_event -> tournament_id -> registrations(user_id)로 대표 registration_id를 찾아 연결
WITH mapped AS (
  SELECT
    ser.id AS ser_id,
    (
      SELECT r.id
      FROM public.side_events se
      JOIN public.registrations r
        ON r.tournament_id = se.tournament_id
      WHERE se.id = ser.side_event_id
        AND r.user_id = ser.user_id
      ORDER BY
        CASE WHEN r.status <> 'canceled' THEN 0 ELSE 1 END,
        r.id DESC
      LIMIT 1
    ) AS matched_registration_id
  FROM public.side_event_registrations ser
)
UPDATE public.side_event_registrations ser
SET registration_id = mapped.matched_registration_id
FROM mapped
WHERE ser.id = mapped.ser_id
  AND ser.registration_id IS NULL;

DO $$
DECLARE
  unresolved_count integer;
BEGIN
  SELECT COUNT(*) INTO unresolved_count
  FROM public.side_event_registrations
  WHERE registration_id IS NULL;

  IF unresolved_count > 0 THEN
    RAISE EXCEPTION
      'side_event_registrations.registration_id backfill failed for % rows',
      unresolved_count;
  END IF;
END $$;

ALTER TABLE public.side_event_registrations
  ALTER COLUMN registration_id SET NOT NULL;

-- 제3자 라운드 신청을 위해 user_id는 nullable 허용
ALTER TABLE public.side_event_registrations
  ALTER COLUMN user_id DROP NOT NULL;

-- 기존 unique(side_event_id, user_id) 제거 (제3자 user_id NULL 케이스 불가)
ALTER TABLE public.side_event_registrations
  DROP CONSTRAINT IF EXISTS side_event_registrations_side_event_id_user_id_key;

-- 같은 라운드 + 같은 registration에 대해 활성 신청(취소 제외) 1건만 허용
CREATE UNIQUE INDEX IF NOT EXISTS side_event_registrations_unique_side_event_registration_active
  ON public.side_event_registrations (side_event_id, registration_id)
  WHERE status <> 'canceled';

CREATE INDEX IF NOT EXISTS idx_side_event_registrations_registration_id
  ON public.side_event_registrations (registration_id);

-- registration 변경 시 nickname/user_id를 registrations 기준으로 동기화
CREATE OR REPLACE FUNCTION public.sync_side_event_registration_from_registration()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  reg_tournament_id bigint;
  side_event_tournament_id bigint;
  reg_user_id uuid;
  reg_nickname text;
BEGIN
  SELECT tournament_id, user_id, nickname
    INTO reg_tournament_id, reg_user_id, reg_nickname
  FROM public.registrations
  WHERE id = NEW.registration_id;

  IF reg_tournament_id IS NULL THEN
    RAISE EXCEPTION 'registration_id % not found', NEW.registration_id;
  END IF;

  SELECT tournament_id
    INTO side_event_tournament_id
  FROM public.side_events
  WHERE id = NEW.side_event_id;

  IF side_event_tournament_id IS NULL THEN
    RAISE EXCEPTION 'side_event_id % not found', NEW.side_event_id;
  END IF;

  IF reg_tournament_id <> side_event_tournament_id THEN
    RAISE EXCEPTION
      'registration % does not belong to side_event % tournament',
      NEW.registration_id, NEW.side_event_id;
  END IF;

  NEW.user_id := reg_user_id;
  NEW.nickname := reg_nickname;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_sync_side_event_registration_from_registration
  ON public.side_event_registrations;

CREATE TRIGGER trg_sync_side_event_registration_from_registration
BEFORE INSERT OR UPDATE OF registration_id, side_event_id
ON public.side_event_registrations
FOR EACH ROW
EXECUTE FUNCTION public.sync_side_event_registration_from_registration();

-- 기존 데이터도 동기화
UPDATE public.side_event_registrations ser
SET
  user_id = r.user_id,
  nickname = r.nickname
FROM public.registrations r
WHERE ser.registration_id = r.id
  AND (ser.user_id IS DISTINCT FROM r.user_id OR ser.nickname IS DISTINCT FROM r.nickname);

-- ============================================================================
-- 2) RLS 정책 전환 (user_id 기준 -> registration_id 기준)
-- ============================================================================

DROP POLICY IF EXISTS "Users can insert own side_event_registration" ON public.side_event_registrations;
DROP POLICY IF EXISTS "side_event_registrations_insert_own" ON public.side_event_registrations;

CREATE POLICY "Users can insert own side_event_registration"
ON public.side_event_registrations
FOR INSERT
WITH CHECK (
  EXISTS (
    SELECT 1
    FROM public.registrations r
    JOIN public.side_events se
      ON se.tournament_id = r.tournament_id
    WHERE r.id = side_event_registrations.registration_id
      AND se.id = side_event_registrations.side_event_id
      AND r.status <> 'canceled'
      AND r.registering_user_id = auth.uid()
  )
  AND public.is_approved_user(auth.uid())
);

DROP POLICY IF EXISTS "Users can update own side_event_registration" ON public.side_event_registrations;
DROP POLICY IF EXISTS "side_event_registrations_update_own" ON public.side_event_registrations;

CREATE POLICY "Users can update own side_event_registration"
ON public.side_event_registrations
FOR UPDATE
USING (
  EXISTS (
    SELECT 1
    FROM public.registrations r
    WHERE r.id = side_event_registrations.registration_id
      AND r.registering_user_id = auth.uid()
  )
  OR public.is_admin(auth.uid())
)
WITH CHECK (
  (
    EXISTS (
      SELECT 1
      FROM public.registrations r
      JOIN public.side_events se
        ON se.tournament_id = r.tournament_id
      WHERE r.id = side_event_registrations.registration_id
        AND se.id = side_event_registrations.side_event_id
        AND r.status <> 'canceled'
        AND r.registering_user_id = auth.uid()
    )
    AND public.is_approved_user(auth.uid())
  )
  OR public.is_admin(auth.uid())
);

DROP POLICY IF EXISTS "Users can delete own side_event_registration" ON public.side_event_registrations;

CREATE POLICY "Users can delete own side_event_registration"
ON public.side_event_registrations
FOR DELETE
USING (
  EXISTS (
    SELECT 1
    FROM public.registrations r
    WHERE r.id = side_event_registrations.registration_id
      AND r.registering_user_id = auth.uid()
  )
  OR public.is_admin(auth.uid())
);
