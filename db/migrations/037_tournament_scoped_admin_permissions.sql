-- Migration: 037_tournament_scoped_admin_permissions.sql
-- Purpose:
--   1) 대회별 임시 관리자 권한(can_manage_tournament) 도입
--   2) 관리자 페이지에서 사용하는 대회 관리 테이블에 scoped admin RLS 확장
--   3) 기존 라운드 관리자 권한(can_manage_side_events) 사용자 백필
-- Date: 2026-03-10
--
-- 본 SQL은 Supabase SQL Editor에서 수동 실행합니다.

-- ============================================================================
-- 1) manager_permissions 확장
-- ============================================================================

alter table public.manager_permissions
add column if not exists can_manage_tournament boolean not null default false;

comment on column public.manager_permissions.can_manage_tournament is '해당 대회 전체 관리 권한';

-- 기존 라운드 관리자에게 대회 관리자 권한을 백필
update public.manager_permissions
set can_manage_tournament = true
where can_manage_side_events = true
  and can_manage_tournament = false;

-- ============================================================================
-- 2) 권한 함수
-- ============================================================================

create or replace function public.can_manage_tournament(p_user_id uuid, p_tournament_id bigint)
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
      and mp.can_manage_tournament = true
      and mp.revoked_at is null
  );
end;
$$;

revoke all on function public.can_manage_tournament(uuid, bigint) from public;
grant execute on function public.can_manage_tournament(uuid, bigint) to authenticated;

create or replace function public.can_manage_side_events(p_user_id uuid, p_tournament_id bigint)
returns boolean
language plpgsql
security definer
set search_path = public
as $$
begin
  if public.can_manage_tournament(p_user_id, p_tournament_id) then
    return true;
  end if;

  return exists (
    select 1
    from public.manager_permissions
    where user_id = p_user_id
      and tournament_id = p_tournament_id
      and can_manage_side_events = true
      and revoked_at is null
  );
end;
$$;

revoke all on function public.can_manage_side_events(uuid, bigint) from public;
grant execute on function public.can_manage_side_events(uuid, bigint) to authenticated;

-- ============================================================================
-- 3) manager_permissions RLS 확장
-- ============================================================================

alter table public.manager_permissions enable row level security;

drop policy if exists manager_permissions_select_own on public.manager_permissions;
create policy manager_permissions_select_own
on public.manager_permissions
for select
using (user_id = auth.uid());

drop policy if exists manager_permissions_manage_scoped on public.manager_permissions;
create policy manager_permissions_manage_scoped
on public.manager_permissions
for all
using (public.can_manage_tournament(auth.uid(), tournament_id))
with check (public.can_manage_tournament(auth.uid(), tournament_id));

-- ============================================================================
-- 4) 대회 관리 테이블 RLS 확장 (scoped admin)
-- ============================================================================

-- tournaments
drop policy if exists tournaments_update_scoped_admin on public.tournaments;
create policy tournaments_update_scoped_admin
on public.tournaments
for update
using (public.can_manage_tournament(auth.uid(), id))
with check (public.can_manage_tournament(auth.uid(), id));

drop policy if exists tournaments_delete_scoped_admin on public.tournaments;
create policy tournaments_delete_scoped_admin
on public.tournaments
for delete
using (public.can_manage_tournament(auth.uid(), id));

-- registrations
drop policy if exists registrations_update_scoped_admin on public.registrations;
create policy registrations_update_scoped_admin
on public.registrations
for update
using (public.can_manage_tournament(auth.uid(), tournament_id))
with check (public.can_manage_tournament(auth.uid(), tournament_id));

drop policy if exists registrations_delete_scoped_admin on public.registrations;
create policy registrations_delete_scoped_admin
on public.registrations
for delete
using (public.can_manage_tournament(auth.uid(), tournament_id));

-- side_events
drop policy if exists side_events_insert_scoped_admin on public.side_events;
create policy side_events_insert_scoped_admin
on public.side_events
for insert
with check (public.can_manage_tournament(auth.uid(), tournament_id));

drop policy if exists side_events_update_scoped_admin on public.side_events;
create policy side_events_update_scoped_admin
on public.side_events
for update
using (public.can_manage_tournament(auth.uid(), tournament_id))
with check (public.can_manage_tournament(auth.uid(), tournament_id));

drop policy if exists side_events_delete_scoped_admin on public.side_events;
create policy side_events_delete_scoped_admin
on public.side_events
for delete
using (public.can_manage_tournament(auth.uid(), tournament_id));

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
      and public.can_manage_tournament(auth.uid(), se.tournament_id)
  )
)
with check (
  exists (
    select 1
    from public.side_events se
    where se.id = side_event_registrations.side_event_id
      and public.can_manage_tournament(auth.uid(), se.tournament_id)
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
      and public.can_manage_tournament(auth.uid(), se.tournament_id)
  )
);

-- tournament_meal_options
drop policy if exists meal_options_insert_scoped_admin on public.tournament_meal_options;
create policy meal_options_insert_scoped_admin
on public.tournament_meal_options
for insert
with check (public.can_manage_tournament(auth.uid(), tournament_id));

drop policy if exists meal_options_update_scoped_admin on public.tournament_meal_options;
create policy meal_options_update_scoped_admin
on public.tournament_meal_options
for update
using (public.can_manage_tournament(auth.uid(), tournament_id))
with check (public.can_manage_tournament(auth.uid(), tournament_id));

drop policy if exists meal_options_delete_scoped_admin on public.tournament_meal_options;
create policy meal_options_delete_scoped_admin
on public.tournament_meal_options
for delete
using (public.can_manage_tournament(auth.uid(), tournament_id));

-- tournament_files
drop policy if exists tournament_files_insert_scoped_admin on public.tournament_files;
create policy tournament_files_insert_scoped_admin
on public.tournament_files
for insert
with check (public.can_manage_tournament(auth.uid(), tournament_id));

drop policy if exists tournament_files_update_scoped_admin on public.tournament_files;
create policy tournament_files_update_scoped_admin
on public.tournament_files
for update
using (public.can_manage_tournament(auth.uid(), tournament_id))
with check (public.can_manage_tournament(auth.uid(), tournament_id));

drop policy if exists tournament_files_delete_scoped_admin on public.tournament_files;
create policy tournament_files_delete_scoped_admin
on public.tournament_files
for delete
using (public.can_manage_tournament(auth.uid(), tournament_id));

-- tournament_extras
drop policy if exists tournament_extras_insert_scoped_admin on public.tournament_extras;
create policy tournament_extras_insert_scoped_admin
on public.tournament_extras
for insert
with check (public.can_manage_tournament(auth.uid(), tournament_id));

drop policy if exists tournament_extras_update_scoped_admin on public.tournament_extras;
create policy tournament_extras_update_scoped_admin
on public.tournament_extras
for update
using (public.can_manage_tournament(auth.uid(), tournament_id))
with check (public.can_manage_tournament(auth.uid(), tournament_id));

drop policy if exists tournament_extras_delete_scoped_admin on public.tournament_extras;
create policy tournament_extras_delete_scoped_admin
on public.tournament_extras
for delete
using (public.can_manage_tournament(auth.uid(), tournament_id));

-- tournament_groups
drop policy if exists tournament_groups_select_scoped_admin on public.tournament_groups;
create policy tournament_groups_select_scoped_admin
on public.tournament_groups
for select
using (
  auth.role() = 'authenticated'
  and public.can_manage_tournament(auth.uid(), tournament_id)
);

drop policy if exists tournament_groups_insert_scoped_admin on public.tournament_groups;
create policy tournament_groups_insert_scoped_admin
on public.tournament_groups
for insert
with check (public.can_manage_tournament(auth.uid(), tournament_id));

drop policy if exists tournament_groups_update_scoped_admin on public.tournament_groups;
create policy tournament_groups_update_scoped_admin
on public.tournament_groups
for update
using (public.can_manage_tournament(auth.uid(), tournament_id))
with check (public.can_manage_tournament(auth.uid(), tournament_id));

drop policy if exists tournament_groups_delete_scoped_admin on public.tournament_groups;
create policy tournament_groups_delete_scoped_admin
on public.tournament_groups
for delete
using (public.can_manage_tournament(auth.uid(), tournament_id));

-- tournament_group_members
drop policy if exists tournament_group_members_select_scoped_admin on public.tournament_group_members;
create policy tournament_group_members_select_scoped_admin
on public.tournament_group_members
for select
using (
  auth.role() = 'authenticated'
  and exists (
    select 1
    from public.tournament_groups g
    where g.id = tournament_group_members.group_id
      and public.can_manage_tournament(auth.uid(), g.tournament_id)
  )
);

drop policy if exists tournament_group_members_insert_scoped_admin on public.tournament_group_members;
create policy tournament_group_members_insert_scoped_admin
on public.tournament_group_members
for insert
with check (
  exists (
    select 1
    from public.tournament_groups g
    where g.id = tournament_group_members.group_id
      and public.can_manage_tournament(auth.uid(), g.tournament_id)
  )
);

drop policy if exists tournament_group_members_update_scoped_admin on public.tournament_group_members;
create policy tournament_group_members_update_scoped_admin
on public.tournament_group_members
for update
using (
  exists (
    select 1
    from public.tournament_groups g
    where g.id = tournament_group_members.group_id
      and public.can_manage_tournament(auth.uid(), g.tournament_id)
  )
)
with check (
  exists (
    select 1
    from public.tournament_groups g
    where g.id = tournament_group_members.group_id
      and public.can_manage_tournament(auth.uid(), g.tournament_id)
  )
);

drop policy if exists tournament_group_members_delete_scoped_admin on public.tournament_group_members;
create policy tournament_group_members_delete_scoped_admin
on public.tournament_group_members
for delete
using (
  exists (
    select 1
    from public.tournament_groups g
    where g.id = tournament_group_members.group_id
      and public.can_manage_tournament(auth.uid(), g.tournament_id)
  )
);
