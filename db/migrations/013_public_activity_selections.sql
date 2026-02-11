-- Migration: 013_public_activity_selections.sql
-- Purpose: registration_activity_selections SELECT 정책을 로그인 사용자에게 공개
-- Date: 2026-02-11
-- 
-- 이 마이그레이션은 Supabase SQL Editor에서 수동으로 실행해야 합니다.
-- 참가자 현황 페이지는 로그인 필수 페이지이므로, 활동 선택 정보도 로그인한 사용자에게 공개합니다.
-- (관리자/일반 사용자 구분 없이 동일한 정보 표시)

-- =========================================
-- 1) 기존 SELECT 정책 제거
-- =========================================

DROP POLICY IF EXISTS select_activity_selections ON public.registration_activity_selections;

-- =========================================
-- 2) 새 SELECT 정책 생성 (로그인 필수)
-- =========================================

-- 로그인한 사용자는 모두 조회 가능 (관리자/일반 구분 없음)
-- 비로그인 상태에서는 RLS에서 차단됨
CREATE POLICY select_activity_selections ON public.registration_activity_selections 
  FOR SELECT USING (
    auth.uid() IS NOT NULL  -- 로그인한 사용자만
  );

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

-- 로그인한 사용자로 조회 테스트
-- SELECT ras.*, te.activity_name
-- FROM public.registration_activity_selections ras
-- JOIN public.tournament_extras te ON ras.extra_id = te.id
-- WHERE ras.selected = true
-- LIMIT 5;
-- 결과: 로그인 상태에서만 데이터 조회 가능

-- 비로그인 상탌(익명 키)으로 조회 시도 → RLS 차단될 것

-- =========================================
-- 마이그레이션 완료
-- =========================================
-- 이후 작업:
-- 1. 참가자 현황 페이지는 로그인 필수 (Frontend에서 처리)
-- 2. 로그인한 사용자는 모든 활동 정보 표시 (관리자/일반 구분 없음)
-- 3. 비로그인 상태에서는 RLS에서 차단되어 데이터 조회 불가
-- 4. E2E 테스트: 비로그인(리다이렉트), 일반 사용자, 관리자 각각 확인
