-- 인증/로그인 실패 추적용 에러 로그 테이블
create table if not exists public.error_logs (
  id bigint generated always as identity primary key,
  created_at timestamptz not null default now(),
  level text not null default 'error',
  category text not null,
  action text not null,
  message text not null,
  error_code text,
  email text,
  auth_user_id uuid,
  path text,
  ip text,
  user_agent text,
  details jsonb not null default '{}'::jsonb
);

comment on table public.error_logs is '로그인/회원가입/OAuth 콜백 실패 로그';
comment on column public.error_logs.category is '도메인 구분 (예: auth)';
comment on column public.error_logs.action is '실패 지점 (예: login_submit, kakao_callback)';
comment on column public.error_logs.details is '추가 디버깅 정보(JSON)';

create index if not exists idx_error_logs_created_at on public.error_logs (created_at desc);
create index if not exists idx_error_logs_category_action on public.error_logs (category, action, created_at desc);
create index if not exists idx_error_logs_email on public.error_logs (email) where email is not null;

alter table public.error_logs enable row level security;
