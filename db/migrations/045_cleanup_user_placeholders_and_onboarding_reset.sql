-- Migration: 045_cleanup_user_placeholders_and_onboarding_reset.sql
-- Purpose:
--   1) nickname이 user- 로 시작하는 계정(auth.users) 연쇄 삭제
--   2) 전체 사용자 온보딩 재강제(onboarding_completed=false)
-- Date: 2026-03-26
--
-- 본 SQL은 Supabase SQL Editor에서 수동 실행합니다.

do $$
declare
  v_target_count integer;
begin
  select count(*)
    into v_target_count
  from public.profiles p
  where lower(coalesce(p.nickname, '')) like 'user-%';

  raise notice 'user-* 삭제 대상 profiles 수: %', v_target_count;
end;
$$;

-- auth.users 삭제 시 관련 데이터는 FK(on delete cascade) 정책에 따라 함께 정리될 수 있습니다.
delete from auth.users u
using public.profiles p
where p.id = u.id
  and lower(coalesce(p.nickname, '')) like 'user-%';

-- 전체 사용자 온보딩 재강제
update auth.users
set raw_user_meta_data = jsonb_set(
  coalesce(raw_user_meta_data, '{}'::jsonb),
  '{onboarding_completed}',
  'false'::jsonb,
  true
);
