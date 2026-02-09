-- ============================================================================
-- Migration 009: Approval Process & Extras System
-- Phase 4 구현: 가입 승인, 활동 선택, 라운드 관리자 권한
-- ============================================================================

-- ============================================================================
-- 1. 기존 테이블 컬럼 추가
-- ============================================================================

-- 1.1 registrations 테이블 - 가입 승인 정보
ALTER TABLE registrations
ADD COLUMN IF NOT EXISTS approval_status VARCHAR(20) DEFAULT 'approved',
ADD COLUMN IF NOT EXISTS approved_at TIMESTAMP DEFAULT NOW(),
ADD COLUMN IF NOT EXISTS approved_by UUID REFERENCES auth.users(id) ON DELETE SET NULL,
ADD COLUMN IF NOT EXISTS created_at TIMESTAMP DEFAULT NOW();

-- Add CHECK constraint separately (if it doesn't exist)
DO $$ 
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint 
    WHERE conname = 'registrations_approval_status_check' 
    AND conrelid = 'registrations'::regclass
  ) THEN
    ALTER TABLE registrations 
    ADD CONSTRAINT registrations_approval_status_check 
    CHECK (approval_status IN ('pending', 'approved', 'rejected'));
  END IF;
END $$;

COMMENT ON COLUMN registrations.approval_status IS '가입 승인 상태: pending(대기), approved(승인), rejected(거절)';
COMMENT ON COLUMN registrations.approved_at IS '승인/거절 처리 시간';
COMMENT ON COLUMN registrations.approved_by IS '가입 승인 처리 관리자 UID';

-- 1.2 side_events 테이블 - 라운드 식사/숙박 정보
ALTER TABLE side_events
ADD COLUMN IF NOT EXISTS meal_option_id BIGINT REFERENCES tournament_meal_options(id) ON DELETE SET NULL,
ADD COLUMN IF NOT EXISTS lodging_available BOOLEAN DEFAULT FALSE,
ADD COLUMN IF NOT EXISTS lodging_required BOOLEAN DEFAULT FALSE;

COMMENT ON COLUMN side_events.meal_option_id IS '라운드에 포함된 식사 옵션';
COMMENT ON COLUMN side_events.lodging_available IS '숙박 옵션 제공 여부';
COMMENT ON COLUMN side_events.lodging_required IS '숙박 필수 여부';

-- 1.3 side_event_registrations 테이블 - 라운드별 사용자 선택
ALTER TABLE side_event_registrations
ADD COLUMN IF NOT EXISTS meal_selected BOOLEAN DEFAULT FALSE,
ADD COLUMN IF NOT EXISTS lodging_selected BOOLEAN DEFAULT FALSE;

COMMENT ON COLUMN side_event_registrations.meal_selected IS '라운드 식사 참여 여부';
COMMENT ON COLUMN side_event_registrations.lodging_selected IS '라운드 숙박 참여 여부';

-- ============================================================================
-- 2. 신규 테이블
-- ============================================================================

-- 2.1 tournament_extras - 토너먼트별 추가 활동
CREATE TABLE IF NOT EXISTS tournament_extras (
  id BIGSERIAL PRIMARY KEY,
  tournament_id BIGINT NOT NULL REFERENCES tournaments(id) ON DELETE CASCADE,
  activity_name VARCHAR(100) NOT NULL,
  description TEXT,
  display_order INT NOT NULL DEFAULT 0,
  is_active BOOLEAN DEFAULT TRUE,
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW()
);

CREATE INDEX idx_tournament_extras_tournament_id 
  ON tournament_extras(tournament_id);

CREATE INDEX idx_tournament_extras_display_order 
  ON tournament_extras(tournament_id, display_order);

CREATE UNIQUE INDEX idx_tournament_extras_unique 
  ON tournament_extras(tournament_id, activity_name) 
  WHERE is_active = TRUE;

COMMENT ON TABLE tournament_extras IS '토너먼트별 추가 활동 (식사, 와인바우 등)';
COMMENT ON COLUMN tournament_extras.activity_name IS '활동명';
COMMENT ON COLUMN tournament_extras.display_order IS '화면 표시 순서';

-- 2.2 registration_activity_selections - 참가자의 활동 선택
CREATE TABLE IF NOT EXISTS registration_activity_selections (
  id BIGSERIAL PRIMARY KEY,
  registration_id BIGINT NOT NULL REFERENCES registrations(id) ON DELETE CASCADE,
  extra_id BIGINT NOT NULL REFERENCES tournament_extras(id) ON DELETE CASCADE,
  selected BOOLEAN DEFAULT TRUE,
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW()
);

CREATE INDEX idx_reg_activity_registration_id 
  ON registration_activity_selections(registration_id);

CREATE INDEX idx_reg_activity_extra_id 
  ON registration_activity_selections(extra_id);

CREATE UNIQUE INDEX idx_reg_activity_unique 
  ON registration_activity_selections(registration_id, extra_id);

COMMENT ON TABLE registration_activity_selections IS '참가자가 선택한 활동들';
COMMENT ON COLUMN registration_activity_selections.selected IS '선택 여부 (true=선택, false=비선택)';

-- 2.3 manager_permissions - 라운드 관리자 권한
CREATE TABLE IF NOT EXISTS manager_permissions (
  id BIGSERIAL PRIMARY KEY,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  tournament_id BIGINT NOT NULL REFERENCES tournaments(id) ON DELETE CASCADE,
  can_manage_side_events BOOLEAN DEFAULT FALSE,
  granted_at TIMESTAMP DEFAULT NOW(),
  granted_by UUID NOT NULL REFERENCES auth.users(id),
  revoked_at TIMESTAMP NULL,
  revoked_by UUID NULL REFERENCES auth.users(id)
);

CREATE INDEX idx_manager_permissions_user_id 
  ON manager_permissions(user_id);

CREATE INDEX idx_manager_permissions_tournament_id 
  ON manager_permissions(tournament_id);

CREATE UNIQUE INDEX idx_manager_perm_unique 
  ON manager_permissions(user_id, tournament_id) 
  WHERE revoked_at IS NULL;

COMMENT ON TABLE manager_permissions IS '라운드 관리자 권한 관리';
COMMENT ON COLUMN manager_permissions.can_manage_side_events IS '라운드(사전/사후 라운드) 관리 권한';
COMMENT ON COLUMN manager_permissions.revoked_at IS '권한 취소 시간 (NULL=활성)';

-- ============================================================================
-- 3. RLS (Row-Level Security) 정책
-- ============================================================================

-- 3.1 tournament_extras RLS
ALTER TABLE tournament_extras ENABLE ROW LEVEL SECURITY;

-- 공개 읽기 (모든 사용자)
CREATE POLICY select_tournament_extras ON tournament_extras 
  FOR SELECT USING (is_active = TRUE);

-- 관리자만 쓰기
CREATE POLICY insert_tournament_extras ON tournament_extras 
  FOR INSERT WITH CHECK (
    (SELECT is_admin FROM profiles WHERE id = auth.uid()) OR
    (SELECT created_by FROM tournaments WHERE id = tournament_id) = auth.uid()
  );

CREATE POLICY update_tournament_extras ON tournament_extras 
  FOR UPDATE USING (
    (SELECT is_admin FROM profiles WHERE id = auth.uid()) OR
    (SELECT created_by FROM tournaments WHERE id = tournament_id) = auth.uid()
  );

CREATE POLICY delete_tournament_extras ON tournament_extras 
  FOR DELETE USING (
    (SELECT is_admin FROM profiles WHERE id = auth.uid()) OR
    (SELECT created_by FROM tournaments WHERE id = tournament_id) = auth.uid()
  );

-- 3.2 registration_activity_selections RLS
ALTER TABLE registration_activity_selections ENABLE ROW LEVEL SECURITY;

-- 자신의 선택 + 관리자는 읽기
CREATE POLICY select_activity_selections ON registration_activity_selections 
  FOR SELECT USING (
    (SELECT user_id FROM registrations WHERE id = registration_id) = auth.uid() OR
    (SELECT is_admin FROM profiles WHERE id = auth.uid())
  );

-- 자신의 등록에만 선택 추가
CREATE POLICY insert_activity_selections ON registration_activity_selections 
  FOR INSERT WITH CHECK (
    (SELECT user_id FROM registrations WHERE id = registration_id) = auth.uid()
  );

-- 자신의 선택만 수정
CREATE POLICY update_activity_selections ON registration_activity_selections 
  FOR UPDATE USING (
    (SELECT user_id FROM registrations WHERE id = registration_id) = auth.uid()
  );

-- 자신의 선택만 삭제
CREATE POLICY delete_activity_selections ON registration_activity_selections 
  FOR DELETE USING (
    (SELECT user_id FROM registrations WHERE id = registration_id) = auth.uid()
  );

-- 3.3 manager_permissions RLS
ALTER TABLE manager_permissions ENABLE ROW LEVEL SECURITY;

-- 관리자만 읽기/쓰기/삭제
CREATE POLICY manage_permissions ON manager_permissions 
  FOR ALL USING (
    (SELECT is_admin FROM profiles WHERE id = auth.uid())
  ) WITH CHECK (
    (SELECT is_admin FROM profiles WHERE id = auth.uid())
  );

-- ============================================================================
-- 4. 업데이트 트리거
-- ============================================================================

-- tournament_extras updated_at 자동 갱신
CREATE TRIGGER update_tournament_extras_timestamp BEFORE UPDATE ON tournament_extras
  FOR EACH ROW EXECUTE FUNCTION set_updated_at();

-- registration_activity_selections updated_at 자동 갱신
CREATE TRIGGER update_activity_selections_timestamp BEFORE UPDATE ON registration_activity_selections
  FOR EACH ROW EXECUTE FUNCTION set_updated_at();

-- ============================================================================
-- 5. 감사 로깅 (Audit Log) - registrations 테이블
-- registrations 테이블의 approval_status 변경 추적
-- ============================================================================

CREATE OR REPLACE FUNCTION audit_registration_approval()
RETURNS TRIGGER AS $$
BEGIN
  IF TG_OP = 'UPDATE' AND (NEW.approval_status IS DISTINCT FROM OLD.approval_status OR NEW.approved_by IS DISTINCT FROM OLD.approved_by) THEN
    INSERT INTO audit_logs (entity_type, entity_id, action, actor_id, before, after)
    VALUES (
      'registrations',
      NEW.id,
      'approval_change',
      COALESCE(auth.uid(), NEW.approved_by),
      jsonb_build_object('approval_status', OLD.approval_status),
      jsonb_build_object('approval_status', NEW.approval_status, 'approved_by', NEW.approved_by)
    );
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

CREATE TRIGGER trg_audit_registration_approval AFTER UPDATE ON registrations
  FOR EACH ROW EXECUTE FUNCTION audit_registration_approval();

-- ============================================================================
-- 6. 헬퍼 함수
-- ============================================================================

-- 토너먼트의 가입 승인 대기 수 조회
CREATE OR REPLACE FUNCTION get_pending_approvals_count(p_tournament_id BIGINT)
RETURNS BIGINT AS $$
BEGIN
  RETURN (
    SELECT COUNT(*)
    FROM registrations
    WHERE tournament_id = p_tournament_id 
      AND approval_status = 'pending'
  );
END;
$$ LANGUAGE plpgsql STABLE;

-- 토너먼트의 승인 현황 조회
CREATE OR REPLACE FUNCTION get_approval_status_summary(p_tournament_id BIGINT)
RETURNS TABLE(
  pending_count BIGINT,
  approved_count BIGINT,
  rejected_count BIGINT,
  total_count BIGINT
) AS $$
BEGIN
  RETURN QUERY
  SELECT 
    COUNT(*) FILTER (WHERE approval_status = 'pending')::BIGINT,
    COUNT(*) FILTER (WHERE approval_status = 'approved')::BIGINT,
    COUNT(*) FILTER (WHERE approval_status = 'rejected')::BIGINT,
    COUNT(*)::BIGINT
  FROM registrations
  WHERE tournament_id = p_tournament_id;
END;
$$ LANGUAGE plpgsql STABLE;

-- 사용자가 토너먼트의 라운드 관리 권한이 있는지 확인
CREATE OR REPLACE FUNCTION can_manage_side_events(p_user_id UUID, p_tournament_id BIGINT)
RETURNS BOOLEAN AS $$
BEGIN
  -- 관리자이면 항상 true
  IF (SELECT is_admin FROM profiles WHERE id = p_user_id) THEN
    RETURN TRUE;
  END IF;
  
  -- 해당 토너먼트의 라운드 관리 권한이 있는지 확인
  RETURN EXISTS (
    SELECT 1
    FROM manager_permissions
    WHERE user_id = p_user_id
      AND tournament_id = p_tournament_id
      AND can_manage_side_events = TRUE
      AND revoked_at IS NULL
  );
END;
$$ LANGUAGE plpgsql STABLE;

-- ============================================================================
-- 7. 마이그레이션 완료 메시지
-- ============================================================================

-- 생성된 테이블과 컬럼 확인을 위한 간단한 소결
-- 이 부분은 실행될 때 콘솔에 나타나진 않지만, 문서화 목적으로 포함
SELECT '✅ Migration 009 완료: 가입 승인 및 활동 선택 시스템 구현' as migration_status;

-- 추가된 테이블:
-- - tournament_extras (토너먼트별 활동)
-- - registration_activity_selections (사용자 활동 선택)
-- - manager_permissions (라운드 관리자 권한)

-- 추가된 컬럼:
-- - registrations: approval_status, approved_at, approved_by, created_at
-- - side_events: meal_option_id, lodging_available, lodging_required
-- - side_event_registrations: meal_selected, lodging_selected
