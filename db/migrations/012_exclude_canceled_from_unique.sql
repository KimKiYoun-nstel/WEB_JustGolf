-- Migration: 012_exclude_canceled_from_unique.sql
-- Purpose: UNIQUE 제약에서 canceled 상태 제외 (삭제된 신청은 중복 체크 안 함)
-- Date: 2026-02-11
-- 
-- 이 마이그레이션은 Supabase SQL Editor에서 수동으로 실행해야 합니다.
-- 취소/삭제된 신청은 UNIQUE 제약에서 제외하여, 동일 닉네임으로 재신청 가능하도록 합니다.

-- =========================================
-- 1) 기존 UNIQUE 인덱스 제거
-- =========================================

-- 회원 등록용 UNIQUE 인덱스 제거
DROP INDEX IF EXISTS public.registrations_unique_member_per_tournament;

-- 제3자 등록용 UNIQUE 인덱스 제거
DROP INDEX IF EXISTS public.registrations_unique_third_party_per_registering_user;

-- =========================================
-- 2) 새 UNIQUE 인덱스 생성 (canceled 제외)
-- =========================================

-- 회원 등록: (tournament_id, user_id) 유니크 (user_id가 NULL이 아니고 status가 canceled가 아닌 경우)
CREATE UNIQUE INDEX registrations_unique_member_per_tournament 
  ON public.registrations (tournament_id, user_id)
  WHERE user_id IS NOT NULL AND status != 'canceled';

-- 제3자 등록: 동일 대회에서 같은 등록자가 같은 닉네임으로 중복 등록 불가 (status가 canceled가 아닌 경우)
CREATE UNIQUE INDEX registrations_unique_third_party_per_registering_user 
  ON public.registrations (tournament_id, registering_user_id, nickname)
  WHERE user_id IS NULL AND status != 'canceled';

-- =========================================
-- 검증 쿼리 (마이그레이션 후 확인용)
-- =========================================

-- 동일 회원이 같은 대회에 여러 번 신청했는지 확인 (canceled 제외)
-- SELECT tournament_id, user_id, COUNT(*) as cnt
-- FROM public.registrations
-- WHERE user_id IS NOT NULL AND status != 'canceled'
-- GROUP BY tournament_id, user_id
-- HAVING COUNT(*) > 1;
-- 결과: 0건 (중복 없어야 함)

-- 동일 등록자가 같은 대회에 같은 닉네임으로 여러 번 등록했는지 확인 (제3자, canceled 제외)
-- SELECT tournament_id, registering_user_id, nickname, COUNT(*) as cnt
-- FROM public.registrations
-- WHERE user_id IS NULL AND status != 'canceled'
-- GROUP BY tournament_id, registering_user_id, nickname
-- HAVING COUNT(*) > 1;
-- 결과: 0건 (중복 없어야 함)

-- =========================================
-- 마이그레이션 완료
-- =========================================
-- 이후 작업:
-- 1. 취소/삭제된 신청은 다시 신청 가능 (동일 닉네임 OK)
-- 2. Frontend에서 "취소" → "삭제" 로직 변경 완료됨 (app/t/[id]/page.tsx)
-- 3. E2E 테스트: 삭제 후 재신청 시나리오 추가
