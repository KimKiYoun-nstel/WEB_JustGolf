-- Migration: 046_update_handle_new_user_placeholder.sql
-- Purpose:
--   신규 가입 시 user- fallback 닉네임 생성 방지
-- Date: 2026-03-26
--
-- 본 SQL은 Supabase SQL Editor에서 수동 실행합니다.

create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  requested_nickname text;
  fallback_nickname text;
  final_nickname text;
  user_suffix text;
begin
  requested_nickname := nullif(trim(new.raw_user_meta_data->>'nickname'), '');
  user_suffix := left(replace(new.id::text, '-', ''), 8);
  fallback_nickname := 'pending-' || user_suffix;

  if requested_nickname is null or lower(requested_nickname) like 'user-%' then
    final_nickname := fallback_nickname;
  else
    if exists (
      select 1
      from public.profiles p
      where lower(p.nickname) = lower(requested_nickname)
    ) then
      final_nickname := requested_nickname || '-' || left(replace(new.id::text, '-', ''), 6);
    else
      final_nickname := requested_nickname;
    end if;
  end if;

  insert into public.profiles (id, nickname, full_name)
  values (
    new.id,
    final_nickname,
    nullif(trim(new.raw_user_meta_data->>'full_name'), '')
  )
  on conflict (id) do nothing;

  return new;
exception
  when unique_violation then
    insert into public.profiles (id, nickname, full_name)
    values (
      new.id,
      'pending-' || left(replace(new.id::text, '-', ''), 6) || '-' || right(replace(new.id::text, '-', ''), 4),
      nullif(trim(new.raw_user_meta_data->>'full_name'), '')
    )
    on conflict (id) do nothing;

    return new;
end;
$$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
after insert on auth.users
for each row execute procedure public.handle_new_user();
