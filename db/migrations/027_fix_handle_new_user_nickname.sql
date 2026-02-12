-- auth.users 신규 생성 시 profiles 기본 닉네임 충돌 방지
-- 카카오/소셜 로그인 신규 유저 생성 실패(Database error saving new user) 대응

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
begin
  requested_nickname := nullif(trim(new.raw_user_meta_data->>'nickname'), '');
  fallback_nickname := 'user-' || left(replace(new.id::text, '-', ''), 8);

  if requested_nickname is null then
    final_nickname := fallback_nickname;
  else
    -- 요청 닉네임이 이미 있으면 사용자별 유니크 suffix를 붙여 충돌 방지
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
    -- 동시성으로 충돌 시에도 auth 유저 생성이 막히지 않도록 강제 fallback
    insert into public.profiles (id, nickname, full_name)
    values (
      new.id,
      fallback_nickname || '-' || right(replace(new.id::text, '-', ''), 4),
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
