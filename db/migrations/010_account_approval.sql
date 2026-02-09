-- Migration: 010_account_approval.sql
-- Purpose: Account approval system (profiles.is_approved)
-- Date: 2026-02-09
--
-- Run this script manually in Supabase SQL Editor.

-- =========================================
-- 1) Add is_approved to profiles
-- =========================================
alter table public.profiles
add column if not exists is_approved boolean not null default false;

-- Backfill existing users as approved
update public.profiles
set is_approved = true
where is_approved = false;

-- =========================================
-- 2) Security definer helpers
-- =========================================
create or replace function public.is_admin_secure(uid uuid)
returns boolean
language sql
security definer
set search_path = public
as $$
  select exists (
    select 1 from public.profiles p
    where p.id = uid and p.is_admin = true
  );
$$;

revoke all on function public.is_admin_secure(uuid) from public;
grant execute on function public.is_admin_secure(uuid) to authenticated;

create or replace function public.is_approved_user(uid uuid)
returns boolean
language sql
security definer
set search_path = public
as $$
  select exists (
    select 1 from public.profiles p
    where p.id = uid and p.is_approved = true
  );
$$;

revoke all on function public.is_approved_user(uuid) from public;
grant execute on function public.is_approved_user(uuid) to authenticated;

-- =========================================
-- 3) Profiles policies for admins
-- =========================================
drop policy if exists "Admins can view all profiles" on public.profiles;
create policy "Admins can view all profiles"
on public.profiles
for select
using (public.is_admin_secure(auth.uid()));

drop policy if exists "Admins can update profiles" on public.profiles;
create policy "Admins can update profiles"
on public.profiles
for update
using (public.is_admin_secure(auth.uid()))
with check (public.is_admin_secure(auth.uid()));

-- =========================================
-- 4) Registrations: require approved account
-- =========================================
drop policy if exists "registrations_insert_own" on public.registrations;
create policy "registrations_insert_own"
on public.registrations for insert
with check (
  auth.uid() = user_id
  and public.is_approved_user(auth.uid())
);

drop policy if exists "registrations_update_own" on public.registrations;
create policy "registrations_update_own"
on public.registrations for update
using (auth.uid() = user_id)
with check (
  auth.uid() = user_id
  and public.is_approved_user(auth.uid())
);

-- =========================================
-- 5) Side event registrations: require approved account
-- =========================================
drop policy if exists "side_event_registrations_insert_own" on public.side_event_registrations;
create policy "side_event_registrations_insert_own"
on public.side_event_registrations for insert
with check (
  auth.uid() = user_id
  and public.is_approved_user(auth.uid())
);

drop policy if exists "side_event_registrations_update_own" on public.side_event_registrations;
create policy "side_event_registrations_update_own"
on public.side_event_registrations for update
using (auth.uid() = user_id)
with check (
  auth.uid() = user_id
  and public.is_approved_user(auth.uid())
);

-- =========================================
-- 6) Registration extras: require approved account
-- =========================================
drop policy if exists "Owners can insert registration extras" on public.registration_extras;
create policy "Owners can insert registration extras"
on public.registration_extras
for insert
with check (
  exists (
    select 1 from public.registrations r
    where r.id = registration_extras.registration_id
      and r.user_id = auth.uid()
  )
  and public.is_approved_user(auth.uid())
);

drop policy if exists "Owners or admins can update registration extras" on public.registration_extras;
create policy "Owners or admins can update registration extras"
on public.registration_extras
for update
using (
  exists (
    select 1 from public.registrations r
    where r.id = registration_extras.registration_id
      and r.user_id = auth.uid()
  )
  or public.is_admin_secure(auth.uid())
)
with check (
  (exists (
    select 1 from public.registrations r
    where r.id = registration_extras.registration_id
      and r.user_id = auth.uid()
  ) and public.is_approved_user(auth.uid()))
  or public.is_admin_secure(auth.uid())
);
