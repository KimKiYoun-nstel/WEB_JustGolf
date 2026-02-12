-- feedback 상태 흐름 표준화 + 댓글 기능

-- 1) 상태 흐름 표준화
update public.feedbacks
set status = 'in_review'
where status = 'in_progress';

alter table public.feedbacks
drop constraint if exists feedbacks_status_check;

alter table public.feedbacks
add constraint feedbacks_status_check
check (status in ('pending', 'received', 'in_review', 'completed', 'deleted'));

comment on column public.feedbacks.status is
'처리상태: pending(대기), received(접수), in_review(확인중), completed(완료), deleted(삭제)';

-- 2) 댓글 테이블
create table if not exists public.feedback_comments (
  id bigserial primary key,
  feedback_id integer not null references public.feedbacks(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  content text not null check (char_length(trim(content)) > 0),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

comment on table public.feedback_comments is '피드백 게시글 댓글';
comment on column public.feedback_comments.feedback_id is '피드백 게시글 ID';
comment on column public.feedback_comments.user_id is '댓글 작성자';
comment on column public.feedback_comments.content is '댓글 내용';

create index if not exists idx_feedback_comments_feedback_id
  on public.feedback_comments (feedback_id, created_at);
create index if not exists idx_feedback_comments_user_id
  on public.feedback_comments (user_id);

-- 3) 댓글 updated_at 트리거
create or replace function public.update_feedback_comments_updated_at()
returns trigger as $$
begin
  new.updated_at = now();
  return new;
end;
$$ language plpgsql;

drop trigger if exists trigger_update_feedback_comments_updated_at on public.feedback_comments;
create trigger trigger_update_feedback_comments_updated_at
before update on public.feedback_comments
for each row execute function public.update_feedback_comments_updated_at();

-- 4) RLS 정책
alter table public.feedback_comments enable row level security;

drop policy if exists "Anyone can view feedback comments" on public.feedback_comments;
create policy "Anyone can view feedback comments"
on public.feedback_comments
for select
using (true);

drop policy if exists "Authenticated users can insert own feedback comments" on public.feedback_comments;
create policy "Authenticated users can insert own feedback comments"
on public.feedback_comments
for insert
to authenticated
with check (auth.uid() = user_id);

drop policy if exists "Users can update own feedback comments" on public.feedback_comments;
create policy "Users can update own feedback comments"
on public.feedback_comments
for update
to authenticated
using (auth.uid() = user_id)
with check (auth.uid() = user_id);

drop policy if exists "Users or admins can delete feedback comments" on public.feedback_comments;
create policy "Users or admins can delete feedback comments"
on public.feedback_comments
for delete
to authenticated
using (
  auth.uid() = user_id
  or exists (
    select 1
    from public.profiles p
    where p.id = auth.uid() and p.is_admin = true
  )
);
