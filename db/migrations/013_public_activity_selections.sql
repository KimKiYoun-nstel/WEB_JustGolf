-- Migration: 013_public_activity_selections.sql
-- Purpose: registration_activity_selections SELECT 정책을 공개로 변경
-- Date: 2026-02-11
-- 
-- 이 마이그레이션은 Supabase SQL Editor에서 수동으로 실행해야 합니다.
-- 참가자 현황 페이지는 공개 페이지이므로, 활동 선택 정보도 공개합니다.
-- (식사 메뉴, 카풀 등 다른 정보와 일관성 유지)

-- =========================================
-- 1) 기존 SELECT 정책 제거
-- =========================================

DROP POLICY IF EXISTS select_activity_selections ON public.registration_activity_selections;

-- =========================================
-- 2) 새 SELECT 정책 생성 (공개)
-- =========================================

-- 누구나 조회 가능 (일반 페이지는 관리자/일반 사용자 구분 없이 동일 정보 출력)
CREATE POLICY select_activity_selections ON public.registration_activity_selections 
  FOR SELECT USING (true);

-- =========================================
-- 참고: 나머지 정책은 유지
-- =========================================
-- INSERT: 자신의 등록에만 추가 가능
-- UPDATE: 자신의 선택만 수정 가능
-- DELETE: 자신의 선택만 삭제 가능
-- (이 정책들은 그대로 유지됨)

-- =========================================
-- 검증 쿼리 (마이그레이션 후 확인용)
-- =========================================

-- 로그인 없이 조회 테스트 (Supabase 익명 키로 테스트)
-- SELECT ras.*, te.activity_name
-- FROM public.registration_activity_selections ras
-- JOIN public.tournament_extras te ON ras.extra_id = te.id
-- WHERE ras.selected = true
-- LIMIT 5;
-- 결과: 데이터 조회 가능 (RLS 통과)

-- =========================================
-- 마이그레이션 완료
-- =========================================
-- 이후 작업:
-- 1. 참가자 현황 페이지에서 모든 사용자의 활동 정보가 표시됨
-- 2. 관리자/일반 사용자 구분 없이 동일한 정보 출력
-- 3. E2E 테스트: 비로그인, 일반 사용자, 관리자 각각 동일한 활동 정보 확인
