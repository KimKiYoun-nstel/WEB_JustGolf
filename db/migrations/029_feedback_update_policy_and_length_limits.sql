-- feedback 작성자 수정 허용 + 제목/내용 길이 제한

alter table public.feedbacks enable row level security;

drop policy if exists "feedbacks_update_own" on public.feedbacks;
create policy "feedbacks_update_own"
on public.feedbacks
for update
to authenticated
using (auth.uid() = user_id)
with check (auth.uid() = user_id);

alter table public.feedbacks
drop constraint if exists feedbacks_title_length_check;

alter table public.feedbacks
add constraint feedbacks_title_length_check
check (char_length(trim(title)) between 1 and 50) not valid;

alter table public.feedbacks
drop constraint if exists feedbacks_content_length_check;

alter table public.feedbacks
add constraint feedbacks_content_length_check
check (char_length(trim(content)) between 1 and 500) not valid;

comment on constraint feedbacks_title_length_check on public.feedbacks is
'피드백 제목 길이 제한: 1~50자';

comment on constraint feedbacks_content_length_check on public.feedbacks is
'피드백 내용 길이 제한: 1~500자';
