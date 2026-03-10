-- Migration: 038_side_event_user_status_guardrails.sql
-- Purpose:
--   1) 일반 사용자 side_event_registrations 신청은 open 기간에만 허용
--   2) 일반 사용자 상태 변경은 applied -> canceled(또는 applied 유지)만 허용
--   3) 일반 사용자 delete 차단(취소 이력 유지)
-- Date: 2026-03-10
--
-- 본 SQL은 Supabase SQL Editor에서 수동 실행합니다.

-- ============================================================================
-- 1) 일반 사용자 insert 가드 (라운드 open + 시간창)
-- ============================================================================

drop policy if exists "Users can insert own side_event_registration" on public.side_event_registrations;
create policy "Users can insert own side_event_registration"
on public.side_event_registrations
for insert
with check (
  exists (
    select 1
    from public.registrations r
    join public.side_events se
      on se.tournament_id = r.tournament_id
    where r.id = side_event_registrations.registration_id
      and se.id = side_event_registrations.side_event_id
      and r.status <> 'canceled'
      and r.registering_user_id = auth.uid()
      and se.status = 'open'
      and (se.open_at is null or now() >= se.open_at)
      and (se.close_at is null or now() <= se.close_at)
  )
  and public.is_approved_user(auth.uid())
);

-- ============================================================================
-- 2) 일반 사용자 update 가드
--    - old row: applied 상태만 수정 가능
--    - new row: applied/canceled 상태만 허용
-- ============================================================================

drop policy if exists "Users can update own side_event_registration" on public.side_event_registrations;
create policy "Users can update own side_event_registration"
on public.side_event_registrations
for update
using (
  (
    exists (
      select 1
      from public.registrations r
      where r.id = side_event_registrations.registration_id
        and r.registering_user_id = auth.uid()
    )
    and side_event_registrations.status = 'applied'
  )
  or public.is_admin_secure(auth.uid())
)
with check (
  (
    exists (
      select 1
      from public.registrations r
      join public.side_events se
        on se.tournament_id = r.tournament_id
      where r.id = side_event_registrations.registration_id
        and se.id = side_event_registrations.side_event_id
        and r.status <> 'canceled'
        and r.registering_user_id = auth.uid()
    )
    and side_event_registrations.status in ('applied', 'canceled')
    and public.is_approved_user(auth.uid())
  )
  or public.is_admin_secure(auth.uid())
);

-- ============================================================================
-- 3) 일반 사용자 delete 차단 (취소 이력 유지)
-- ============================================================================

drop policy if exists "Users can delete own side_event_registration" on public.side_event_registrations;
create policy "Users can delete own side_event_registration"
on public.side_event_registrations
for delete
using (public.is_admin_secure(auth.uid()));