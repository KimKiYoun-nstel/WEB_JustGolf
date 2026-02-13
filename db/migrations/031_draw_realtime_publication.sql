-- Migration: 031_draw_realtime_publication.sql
-- Purpose: Ensure live draw tables are included in Supabase Realtime publication
-- Date: 2026-02-13

do $$
begin
  if exists (
    select 1
    from pg_publication
    where pubname = 'supabase_realtime'
  ) then
    if not exists (
      select 1
      from pg_publication_tables
      where pubname = 'supabase_realtime'
        and schemaname = 'public'
        and tablename = 'draw_events'
    ) then
      alter publication supabase_realtime add table public.draw_events;
    end if;

    if not exists (
      select 1
      from pg_publication_tables
      where pubname = 'supabase_realtime'
        and schemaname = 'public'
        and tablename = 'draw_sessions'
    ) then
      alter publication supabase_realtime add table public.draw_sessions;
    end if;
  end if;
end
$$;
