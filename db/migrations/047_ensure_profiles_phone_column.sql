-- Migration: 047_ensure_profiles_phone_column.sql
-- Purpose:
--   1) profiles.phone 컬럼이 누락된 환경을 복구
--   2) auth 메타데이터의 phone 값을 profiles.phone으로 보강
-- Date: 2026-03-26
--
-- 본 SQL은 Supabase SQL Editor에서 수동 실행합니다.

alter table public.profiles
  add column if not exists phone text;

comment on column public.profiles.phone is '전화번호 (온보딩 필수 입력)';

update public.profiles p
set phone = nullif(trim(u.raw_user_meta_data->>'phone'), '')
from auth.users u
where p.id = u.id
  and nullif(trim(coalesce(p.phone, '')), '') is null
  and nullif(trim(u.raw_user_meta_data->>'phone'), '') is not null;
