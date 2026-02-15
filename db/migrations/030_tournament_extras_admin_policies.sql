-- Migration: 030_tournament_extras_admin_policies.sql
-- Purpose: Fix admin update/delete permissions for tournament_extras
-- Date: 2026-02-15
--
-- Run this script manually in Supabase SQL Editor.

-- Ensure admin helper exists (fallback for environments missing it)
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

alter table public.tournament_extras enable row level security;

grant select, insert, update, delete on public.tournament_extras to authenticated;

-- Replace existing policies to avoid recursive profile checks

drop policy if exists select_tournament_extras on public.tournament_extras;
drop policy if exists insert_tournament_extras on public.tournament_extras;
drop policy if exists update_tournament_extras on public.tournament_extras;
drop policy if exists delete_tournament_extras on public.tournament_extras;

-- Public read of active items
create policy select_tournament_extras on public.tournament_extras
for select
using (is_active = true);

-- Admins or tournament creator can write
create policy insert_tournament_extras on public.tournament_extras
for insert
with check (
  public.is_admin_secure(auth.uid())
  or (select created_by from public.tournaments t where t.id = tournament_id) = auth.uid()
);

create policy update_tournament_extras on public.tournament_extras
for update
using (
  public.is_admin_secure(auth.uid())
  or (select created_by from public.tournaments t where t.id = tournament_id) = auth.uid()
)
with check (
  public.is_admin_secure(auth.uid())
  or (select created_by from public.tournaments t where t.id = tournament_id) = auth.uid()
);

create policy delete_tournament_extras on public.tournament_extras
for delete
using (
  public.is_admin_secure(auth.uid())
  or (select created_by from public.tournaments t where t.id = tournament_id) = auth.uid()
);
