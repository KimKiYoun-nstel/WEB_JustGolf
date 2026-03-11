-- 041_aggregate_summary_rpcs.sql
-- Purpose: Summary RPCs for round preferences and side-event registration counts.

create or replace function public.get_round_preference_counts_by_tournaments(tournament_ids bigint[])
returns table (
  tournament_id bigint,
  pre_preferred_count bigint,
  post_preferred_count bigint,
  any_preferred_count bigint
)
language sql
stable
as $$
  select
    r.tournament_id,
    count(*) filter (
      where r.status <> 'canceled' and r.pre_round_preferred = true
    ) as pre_preferred_count,
    count(*) filter (
      where r.status <> 'canceled' and r.post_round_preferred = true
    ) as post_preferred_count,
    count(*) filter (
      where r.status <> 'canceled' and (r.pre_round_preferred = true or r.post_round_preferred = true)
    ) as any_preferred_count
  from public.registrations r
  where r.tournament_id = any(tournament_ids)
  group by r.tournament_id
  order by r.tournament_id;
$$;

comment on function public.get_round_preference_counts_by_tournaments is
  'Returns per-tournament round preference counts (pre/post/any) excluding canceled registrations.';

create or replace function public.get_side_event_summaries_by_tournaments(tournament_ids bigint[])
returns table (
  side_event_id bigint,
  tournament_id bigint,
  round_type text,
  title text,
  registration_count bigint
)
language sql
stable
as $$
  select
    se.id as side_event_id,
    se.tournament_id,
    se.round_type,
    se.title,
    count(ser.id) filter (where ser.status <> 'canceled') as registration_count
  from public.side_events se
  left join public.side_event_registrations ser
    on ser.side_event_id = se.id
  where se.tournament_id = any(tournament_ids)
  group by se.id, se.tournament_id, se.round_type, se.title
  order by se.tournament_id, se.round_type, se.id;
$$;

comment on function public.get_side_event_summaries_by_tournaments is
  'Returns side-event summaries with active registration counts per tournament.';

create index if not exists idx_side_events_tournament_round_id
on public.side_events (tournament_id, round_type, id);

create index if not exists idx_side_event_registrations_side_event_status
on public.side_event_registrations (side_event_id, status);
