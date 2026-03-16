-- Migration: 043_kakao_oidc_state_store.sql
-- Purpose: Stabilize Kakao OIDC state verification with server-side one-time state store
-- Date: 2026-03-16
-- Run this script manually in Supabase SQL Editor.

create table if not exists public.kakao_oidc_states (
  state text primary key,
  intent text not null
    check (intent in ('sign_in', 'link')),
  expected_user_id uuid references auth.users(id) on delete cascade,
  issued_ip text,
  issued_user_agent text,
  consumed_ip text,
  consumed_user_agent text,
  expires_at timestamptz not null,
  consumed_at timestamptz,
  created_at timestamptz not null default now()
);

comment on table public.kakao_oidc_states is
'Server-side Kakao OIDC state store (one-time use, short TTL)';
comment on column public.kakao_oidc_states.intent is
'state intent: sign_in or link';
comment on column public.kakao_oidc_states.expected_user_id is
'For link intent, the user id that must complete callback';

create index if not exists idx_kakao_oidc_states_expires_at
on public.kakao_oidc_states(expires_at);

create index if not exists idx_kakao_oidc_states_expected_user_id
on public.kakao_oidc_states(expected_user_id)
where expected_user_id is not null;

create index if not exists idx_kakao_oidc_states_unconsumed_expires_at
on public.kakao_oidc_states(expires_at)
where consumed_at is null;

alter table public.kakao_oidc_states enable row level security;
