-- Migration: 009_third_party_registrations.sql
-- Purpose: 제3자 대리 신청 기능 지원
-- Date: 2026-02-11
-- 
-- 이 마이그레이션은 Supabase SQL Editor에서 수동으로 실행해야 합니다.
-- 로그인한 회원이 비회원(제3자)을 대회에 대리 신청할 수 있도록 스키마를 변경합니다.

-- =========================================
-- 1) registrations 테이블 구조 변경
-- =========================================

-- 1-1. registering_user_id 컬럼 추가 (실제 신청을 수행한 회원)
ALTER TABLE public.registrations 
  ADD COLUMN registering_user_id uuid REFERENCES auth.users(id) ON DELETE CASCADE;

-- 1-2. 기존 데이터 백필: 기존 레코드는 본인이 신청한 것으로 간주
UPDATE public.registrations
SET registering_user_id = user_id
WHERE registering_user_id IS NULL;

-- 1-3. registering_user_id를 NOT NULL로 설정
ALTER TABLE public.registrations
ALTER COLUMN registering_user_id SET NOT NULL;

-- 1-4. user_id NULL 허용 (제3자는 user_id = NULL)
ALTER TABLE public.registrations
ALTER COLUMN user_id DROP NOT NULL;

-- =========================================
-- 2) UNIQUE 제약 재구성
-- =========================================

-- 2-1. 기존 UNIQUE 제약 제거
ALTER TABLE public.registrations 
  DROP CONSTRAINT IF EXISTS registrations_tournament_id_user_id_key;

-- 2-2. 회원 등록: (tournament_id, user_id) 유니크 (user_id가 NULL이 아닌 경우)
CREATE UNIQUE INDEX registrations_unique_member_per_tournament 
  ON public.registrations (tournament_id, user_id)
  WHERE user_id IS NOT NULL;

-- 2-3. 제3자 등록: 동일 대회에서 같은 등록자가 같은 닉네임으로 중복 등록 불가
CREATE UNIQUE INDEX registrations_unique_third_party_per_registering_user 
  ON public.registrations (tournament_id, registering_user_id, nickname)
  WHERE user_id IS NULL;

-- =========================================
-- 3) RLS 정책 업데이트
-- =========================================

-- 3-1. INSERT 정책: 본인 또는 제3자 등록 가능
DROP POLICY IF EXISTS "Users can insert own registration" ON public.registrations;
DROP POLICY IF EXISTS "Users can insert registrations" ON public.registrations;

CREATE POLICY "Users can insert registrations"
ON public.registrations
FOR INSERT
WITH CHECK (
  -- 본인 등록: user_id = auth.uid() AND registering_user_id = auth.uid()
  (user_id = auth.uid() AND registering_user_id = auth.uid())
  OR
  -- 제3자 등록: user_id IS NULL AND registering_user_id = auth.uid()
  (user_id IS NULL AND registering_user_id = auth.uid())
);

-- 3-2. UPDATE 정책: 본인, 등록자, 관리자만 수정 가능
DROP POLICY IF EXISTS "Users can update own registration" ON public.registrations;
DROP POLICY IF EXISTS "Users can update registrations" ON public.registrations;

CREATE POLICY "Users can update registrations"
ON public.registrations
FOR UPDATE
USING (
  auth.uid() = user_id                          -- 본인 (회원)
  OR auth.uid() = registering_user_id           -- 등록자 (대리 신청자)
  OR EXISTS (
    SELECT 1 FROM public.profiles
    WHERE profiles.id = auth.uid() AND profiles.is_admin = true
  )                                              -- 관리자
);

-- 3-3. DELETE 정책: 등록자 또는 관리자만 삭제 가능
DROP POLICY IF EXISTS "Users can delete own registration" ON public.registrations;
DROP POLICY IF EXISTS "Users can delete registrations" ON public.registrations;

CREATE POLICY "Users can delete registrations"
ON public.registrations
FOR DELETE
USING (
  auth.uid() = registering_user_id              -- 등록자
  OR EXISTS (
    SELECT 1 FROM public.profiles
    WHERE profiles.id = auth.uid() AND profiles.is_admin = true
  )                                              -- 관리자
);

-- =========================================
-- 4) 검증 쿼리 (마이그레이션 후 확인용)
-- =========================================

-- 4-1. 모든 레코드에 registering_user_id가 설정되었는지 확인
-- SELECT COUNT(*) FROM public.registrations WHERE registering_user_id IS NULL;
-- 결과: 0 (모든 레코드에 registering_user_id가 있어야 함)

-- 4-2. 제3자 등록 레코드 개수 확인 (마이그레이션 직후에는 0)
-- SELECT COUNT(*) FROM public.registrations WHERE user_id IS NULL;
-- 결과: 0 (아직 제3자 등록이 없음)

-- 4-3. UNIQUE 제약 테스트 (실제 실행하지 말고 참고용)
-- -- 회원 중복 등록 시도 (실패해야 함)
-- INSERT INTO public.registrations (tournament_id, user_id, registering_user_id, nickname, status)
-- VALUES (1, 'existing-user-id', 'existing-user-id', 'Test', 'applied');
-- 
-- -- 제3자 중복 등록 시도 (같은 등록자, 같은 대회, 같은 닉네임 - 실패해야 함)
-- INSERT INTO public.registrations (tournament_id, user_id, registering_user_id, nickname, status)
-- VALUES (1, NULL, 'existing-user-id', 'Bob', 'applied');

-- =========================================
-- 마이그레이션 완료
-- =========================================
-- 이후 작업:
-- 1. Frontend에서 제3자 등록 UI 구현 (app/t/[id]/page.tsx)
-- 2. 관리자 페이지에서 등록자 정보 표시 (app/admin/tournaments/[id]/page.tsx)
-- 3. E2E 테스트 작성 및 실행
