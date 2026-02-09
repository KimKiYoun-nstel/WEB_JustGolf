-- 011_multi_participant_and_undecided.sql
-- Phase 5 implementation: Multi-participant registration, undecided status, tri-state options

-- 1. Add relation column to registrations (for multi-participant support)
ALTER TABLE registrations
ADD COLUMN IF NOT EXISTS relation TEXT;

COMMENT ON COLUMN registrations.relation IS '참가자와 신청자의 관계 (예: 본인, 가족, 지인)';

-- 2. Expand registration status to include 'undecided'
-- Note: If status column is already TEXT, this is safe. If it's an enum, you may need to alter the type.
-- For flexibility, we'll ensure it's TEXT and add a check constraint instead of enum
ALTER TABLE registrations
ALTER COLUMN status TYPE TEXT;

ALTER TABLE registrations
DROP CONSTRAINT IF EXISTS registrations_status_check;

ALTER TABLE registrations
ADD CONSTRAINT registrations_status_check
CHECK (status IN ('applied', 'waitlisted', 'approved', 'canceled', 'undecided'));

COMMENT ON COLUMN registrations.status IS '신청 상태: applied(신청), undecided(미정), waitlisted(대기), approved(승인), canceled(취소)';

-- 3. Allow NULL for carpool_available (tri-state: null=undecided, true=yes, false=no)
ALTER TABLE registration_extras
ALTER COLUMN carpool_available DROP NOT NULL;

COMMENT ON COLUMN registration_extras.carpool_available IS '카풀 제공 여부: null=미정, true=제공, false=불제공';

-- 4. Create tournament_prize_supports table
CREATE TABLE IF NOT EXISTS tournament_prize_supports (
  id SERIAL PRIMARY KEY,
  tournament_id INTEGER NOT NULL REFERENCES tournaments(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  item_name TEXT NOT NULL,
  note TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_prize_supports_tournament ON tournament_prize_supports(tournament_id);
CREATE INDEX IF NOT EXISTS idx_prize_supports_user ON tournament_prize_supports(user_id);

COMMENT ON TABLE tournament_prize_supports IS '대회별 경품 지원 내역';
COMMENT ON COLUMN tournament_prize_supports.item_name IS '경품명';
COMMENT ON COLUMN tournament_prize_supports.note IS '비고 (선택)';

-- 5. RLS policies for tournament_prize_supports
ALTER TABLE tournament_prize_supports ENABLE ROW LEVEL SECURITY;

-- Allow authenticated users to insert their own prize supports
CREATE POLICY "Users can insert their own prize supports"
ON tournament_prize_supports
FOR INSERT
TO authenticated
WITH CHECK (auth.uid() = user_id);

-- Allow all users (including public) to view prize supports
CREATE POLICY "Anyone can view prize supports"
ON tournament_prize_supports
FOR SELECT
TO public
USING (true);

-- 6. Update trigger for tournament_prize_supports
CREATE OR REPLACE FUNCTION update_tournament_prize_supports_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trigger_update_tournament_prize_supports_updated_at
BEFORE UPDATE ON tournament_prize_supports
FOR EACH ROW
EXECUTE FUNCTION update_tournament_prize_supports_updated_at();

-- Migration complete
-- Run this in Supabase SQL Editor before deploying Phase 5 features
