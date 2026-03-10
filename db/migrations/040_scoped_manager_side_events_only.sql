-- Migration: 040_scoped_manager_side_events_only.sql
-- Purpose:
--   1) 스코프 관리자 권한을 사전/사후 라운드 관리로 제한
--   2) can_manage_tournament 기반 확장 RLS 권한 제거
--   3) side_events / side_event_registrations만 scoped 권한 유지
-- Date: 2026-03-10
--
-- 본 SQL은 Supabase SQL Editor에서 수동 실행합니다.

-- ============================================================================
-- 1) 스코프 전체관리 플래그 비활성화
-- ============================================================================

update public.manager_permissions
set can_manage_tournament = false
where can_manage_tournament = true;

-- ============================================================================
-- 2) 권한 함수 정리 (라운드 권한 only)
-- ============================================================================

create or replace function public.can_manage_side_events(p_user_id uuid, p_tournament_id bigint)
returns boolean
language plpgsql
security definer
set search_path = public
as $$
begin
  if p_user_id is null or p_tournament_id is null then
    return false;
  end if;

  if public.is_admin_secure(p_user_id) then
    return true;
  end if;

  return exists (
    select 1
    from public.manager_permissions mp
    where mp.user_id = p_user_id
      and mp.tournament_id = p_tournament_id
      and mp.can_manage_side_events = true
      and mp.revoked_at is null
  );
end;
$$;

revoke all on function public.can_manage_side_events(uuid, bigint) from public;
grant execute on function public.can_manage_side_events(uuid, bigint) to authenticated;

-- ============================================================================
-- 3) manager_permissions RLS (상위관리자 only)
-- ============================================================================

alter table public.manager_permissions enable row level security;

drop policy if exists manager_permissions_select_own on public.manager_permissions;
create policy manager_permissions_select_own
on public.manager_permissions
for select
using (user_id = auth.uid());

drop policy if exists manager_permissions_manage_scoped on public.manager_permissions;
drop policy if exists manager_permissions_manage_admin_only on public.manager_permissions;
create policy manager_permissions_manage_admin_only
on public.manager_permissions
for all
using (public.is_admin_secure(auth.uid()))
with check (public.is_admin_secure(auth.uid()));

-- ============================================================================
-- 4) can_manage_tournament 기반 scoped RLS 제거
-- ============================================================================

-- tournaments
drop policy if exists tournaments_update_scoped_admin on public.tournaments;
drop policy if exists tournaments_delete_scoped_admin on public.tournaments;

-- registrations
drop policy if exists registrations_update_scoped_admin on public.registrations;
drop policy if exists registrations_delete_scoped_admin on public.registrations;

-- meal options
drop policy if exists meal_options_insert_scoped_admin on public.tournament_meal_options;
drop policy if exists meal_options_update_scoped_admin on public.tournament_meal_options;
drop policy if exists meal_options_delete_scoped_admin on public.tournament_meal_options;

-- files
drop policy if exists tournament_files_insert_scoped_admin on public.tournament_files;
drop policy if exists tournament_files_update_scoped_admin on public.tournament_files;
drop policy if exists tournament_files_delete_scoped_admin on public.tournament_files;

-- extras
drop policy if exists tournament_extras_insert_scoped_admin on public.tournament_extras;
drop policy if exists tournament_extras_update_scoped_admin on public.tournament_extras;
drop policy if exists tournament_extras_delete_scoped_admin on public.tournament_extras;

-- groups
drop policy if exists tournament_groups_select_scoped_admin on public.tournament_groups;
drop policy if exists tournament_groups_insert_scoped_admin on public.tournament_groups;
drop policy if exists tournament_groups_update_scoped_admin on public.tournament_groups;
drop policy if exists tournament_groups_delete_scoped_admin on public.tournament_groups;

-- group members
drop policy if exists tournament_group_members_select_scoped_admin on public.tournament_group_members;
drop policy if exists tournament_group_members_insert_scoped_admin on public.tournament_group_members;
drop policy if exists tournament_group_members_update_scoped_admin on public.tournament_group_members;
drop policy if exists tournament_group_members_delete_scoped_admin on public.tournament_group_members;

-- ============================================================================
-- 5) 라운드 관련 scoped RLS를 can_manage_side_events로 재구성
-- ============================================================================

-- side_events
drop policy if exists side_events_insert_scoped_admin on public.side_events;
create policy side_events_insert_scoped_admin
on public.side_events
for insert
with check (public.can_manage_side_events(auth.uid(), tournament_id));

drop policy if exists side_events_update_scoped_admin on public.side_events;
create policy side_events_update_scoped_admin
on public.side_events
for update
using (public.can_manage_side_events(auth.uid(), tournament_id))
with check (public.can_manage_side_events(auth.uid(), tournament_id));

drop policy if exists side_events_delete_scoped_admin on public.side_events;
create policy side_events_delete_scoped_admin
on public.side_events
for delete
using (public.can_manage_side_events(auth.uid(), tournament_id));

-- side_event_registrations
drop policy if exists side_event_registrations_update_scoped_admin on public.side_event_registrations;
create policy side_event_registrations_update_scoped_admin
on public.side_event_registrations
for update
using (
  exists (
    select 1
    from public.side_events se
    where se.id = side_event_registrations.side_event_id
      and public.can_manage_side_events(auth.uid(), se.tournament_id)
  )
)
with check (
  exists (
    select 1
    from public.side_events se
    where se.id = side_event_registrations.side_event_id
      and public.can_manage_side_events(auth.uid(), se.tournament_id)
  )
);

drop policy if exists side_event_registrations_delete_scoped_admin on public.side_event_registrations;
create policy side_event_registrations_delete_scoped_admin
on public.side_event_registrations
for delete
using (
  exists (
    select 1
    from public.side_events se
    where se.id = side_event_registrations.side_event_id
      and public.can_manage_side_events(auth.uid(), se.tournament_id)
  )
);
