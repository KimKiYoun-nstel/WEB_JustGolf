-- Migration: 039_force_onboarding_reverification.sql
-- Purpose:
--   1) 모든 기존 사용자에게 onboarding_completed=false 재설정
--   2) 배포 후 로그인 시점에 온보딩 1회 재진행 강제
-- Date: 2026-03-10
--
-- 본 SQL은 Supabase SQL Editor에서 수동 실행합니다.

update auth.users
set raw_user_meta_data = jsonb_set(
  coalesce(raw_user_meta_data, '{}'::jsonb),
  '{onboarding_completed}',
  'false'::jsonb,
  true
);
