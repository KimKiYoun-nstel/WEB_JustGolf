-- registrations 대회별 상태 집계 조회 성능 개선
-- Supabase SQL Editor에서 수동 실행

create index if not exists idx_registrations_tournament_status
on public.registrations (tournament_id, status);
