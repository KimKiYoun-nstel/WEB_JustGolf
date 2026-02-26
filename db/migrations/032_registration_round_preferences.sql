-- Migration: 032_registration_round_preferences.sql
-- Purpose: registrations에 사전/사후 라운드 희망 여부 컬럼 추가

alter table public.registrations
  add column if not exists pre_round_preferred boolean not null default false,
  add column if not exists post_round_preferred boolean not null default false;

comment on column public.registrations.pre_round_preferred is
  '사전 라운드 참가 희망 여부 (라운드 오픈/신청 여부와 별개)';

comment on column public.registrations.post_round_preferred is
  '사후 라운드 참가 희망 여부 (라운드 오픈/신청 여부와 별개)';
