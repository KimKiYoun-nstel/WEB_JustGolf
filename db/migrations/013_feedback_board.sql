-- 013_feedback_board.sql
-- 사용자 피드백 게시판

-- 1. feedbacks 테이블 생성
CREATE TABLE IF NOT EXISTS feedbacks (
  id SERIAL PRIMARY KEY,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  title TEXT NOT NULL,
  content TEXT NOT NULL,
  category TEXT NOT NULL DEFAULT 'general',
  status TEXT NOT NULL DEFAULT 'pending',
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_feedbacks_user ON feedbacks(user_id);
CREATE INDEX IF NOT EXISTS idx_feedbacks_status ON feedbacks(status);
CREATE INDEX IF NOT EXISTS idx_feedbacks_created ON feedbacks(created_at DESC);

COMMENT ON TABLE feedbacks IS '사용자 피드백 게시판';
COMMENT ON COLUMN feedbacks.title IS '피드백 제목';
COMMENT ON COLUMN feedbacks.content IS '피드백 내용';
COMMENT ON COLUMN feedbacks.category IS '카테고리: bug(버그), feature(기능요청), general(일반)';
COMMENT ON COLUMN feedbacks.status IS '처리상태: pending(대기), in_progress(진행중), completed(완료)';

-- 2. RLS 정책
ALTER TABLE feedbacks ENABLE ROW LEVEL SECURITY;

-- 모든 사용자가 피드백 조회 가능 (투명성)
CREATE POLICY "Anyone can view feedbacks"
ON feedbacks
FOR SELECT
TO public
USING (true);

-- 인증된 사용자는 자신의 피드백 작성 가능
CREATE POLICY "Authenticated users can insert their own feedback"
ON feedbacks
FOR INSERT
TO authenticated
WITH CHECK (auth.uid() = user_id);

-- 작성자는 자신의 피드백 수정 가능
CREATE POLICY "Users can update their own feedback"
ON feedbacks
FOR UPDATE
TO authenticated
USING (auth.uid() = user_id)
WITH CHECK (auth.uid() = user_id);

-- 관리자는 모든 피드백의 status 업데이트 가능
CREATE POLICY "Admins can update feedback status"
ON feedbacks
FOR UPDATE
TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM public.profiles
    WHERE profiles.id = auth.uid() AND profiles.is_admin = true
  )
);

-- 작성자는 자신의 피드백 삭제 가능
CREATE POLICY "Users can delete their own feedback"
ON feedbacks
FOR DELETE
TO authenticated
USING (auth.uid() = user_id);

-- 3. 업데이트 트리거
CREATE OR REPLACE FUNCTION update_feedbacks_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trigger_update_feedbacks_updated_at
BEFORE UPDATE ON feedbacks
FOR EACH ROW
EXECUTE FUNCTION update_feedbacks_updated_at();

-- 마이그레이션 완료
-- Supabase SQL 에디터에서 실행
