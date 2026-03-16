-- Migration: 042_draw_chat_session_decouple_and_live_unique.sql
-- Purpose: Decouple draw chat session from draw session lifecycle and enforce one live chat per tournament
-- Date: 2026-03-16
-- Run this script manually in Supabase SQL Editor.

alter table public.draw_chat_sessions
drop constraint if exists draw_chat_sessions_draw_session_unique;

alter table public.draw_chat_sessions
drop constraint if exists draw_chat_sessions_draw_session_id_fkey;

do $$
begin
  if exists (
    select 1
    from information_schema.columns
    where table_schema = 'public'
      and table_name = 'draw_chat_sessions'
      and column_name = 'draw_session_id'
  ) and not exists (
    select 1
    from information_schema.columns
    where table_schema = 'public'
      and table_name = 'draw_chat_sessions'
      and column_name = 'linked_draw_session_id'
  ) then
    alter table public.draw_chat_sessions
    rename column draw_session_id to linked_draw_session_id;
  end if;
end
$$;

do $$
begin
  if not exists (
    select 1
    from information_schema.columns
    where table_schema = 'public'
      and table_name = 'draw_chat_sessions'
      and column_name = 'linked_draw_session_id'
  ) then
    alter table public.draw_chat_sessions
    add column linked_draw_session_id bigint;
  end if;
end
$$;

do $$
begin
  if exists (
    select 1
    from information_schema.columns
    where table_schema = 'public'
      and table_name = 'draw_chat_sessions'
      and column_name = 'linked_draw_session_id'
      and is_nullable = 'NO'
  ) then
    alter table public.draw_chat_sessions
    alter column linked_draw_session_id drop not null;
  end if;
end
$$;

do $$
begin
  if exists (
    select 1
    from information_schema.columns
    where table_schema = 'public'
      and table_name = 'draw_chat_sessions'
      and column_name = 'draw_session_id'
  ) then
    update public.draw_chat_sessions
    set linked_draw_session_id = coalesce(linked_draw_session_id, draw_session_id);

    alter table public.draw_chat_sessions
    drop column draw_session_id;
  end if;
end
$$;

do $$
begin
  if not exists (
    select 1
    from pg_constraint
    where conname = 'draw_chat_sessions_linked_draw_session_id_fkey'
  ) then
    alter table public.draw_chat_sessions
    add constraint draw_chat_sessions_linked_draw_session_id_fkey
    foreign key (linked_draw_session_id)
    references public.draw_sessions(id)
    on delete set null;
  end if;
end
$$;

create index if not exists idx_draw_chat_sessions_linked_draw_session_id
on public.draw_chat_sessions(linked_draw_session_id);

with ranked_live as (
  select
    id,
    row_number() over (partition by tournament_id order by id desc) as rn
  from public.draw_chat_sessions
  where status = 'live'
)
update public.draw_chat_sessions dcs
set status = 'closed',
    closed_at = coalesce(dcs.closed_at, now())
from ranked_live rl
where dcs.id = rl.id
  and rl.rn > 1;

create unique index if not exists uq_draw_chat_sessions_live_tournament
on public.draw_chat_sessions(tournament_id)
where status = 'live';
