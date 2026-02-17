-- Migration: 031_admin_soft_delete_tournament_extra.sql
-- Purpose: Provide admin/creator soft delete for tournament_extras via RPC
-- Date: 2026-02-15
--
-- Run this script manually in Supabase SQL Editor.

create or replace function public.admin_soft_delete_tournament_extra(extra_id bigint)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  if not public.is_admin_secure(auth.uid())
     and (
       select t.created_by
       from public.tournament_extras te
       join public.tournaments t on t.id = te.tournament_id
       where te.id = extra_id
     ) <> auth.uid() then
    raise exception 'permission denied';
  end if;

  update public.tournament_extras
  set is_active = false
  where id = extra_id;
end;
$$;

revoke all on function public.admin_soft_delete_tournament_extra(bigint) from public;
grant execute on function public.admin_soft_delete_tournament_extra(bigint) to authenticated;
