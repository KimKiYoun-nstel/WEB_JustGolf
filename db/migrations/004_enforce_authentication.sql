-- Migration: 004_enforce_authentication.sql
-- Purpose: 비로그인 사용자 접근 차단 (로그인 전용 서비스 전환)
-- Date: 2026-02-09
-- 
-- 이 마이그레이션은 Supabase SQL Editor에서 수동으로 실행해야 합니다.
-- 모든 주요 테이블의 SELECT 정책을 "인증된 사용자만" 접근 가능하도록 변경합니다.

-- =========================================
-- 1) tournaments 테이블 - 기존 공개 정책 제거하고 인증 필수
-- =========================================
-- 기존 정책 삭제
drop policy if exists "tournaments_select_public" on public.tournaments;
drop policy if exists "Public can view tournaments" on public.tournaments;
drop policy if exists "Anyone can view tournaments" on public.tournaments;

-- 새 정책: 인증된 사용자만 조회
create policy "Authenticated users can view tournaments"
on public.tournaments
for select
using (auth.role() = 'authenticated');

-- 관리자만 insert/update/delete (기존 정책 유지 또는 재생성)
drop policy if exists "Admins can insert tournaments" on public.tournaments;
create policy "Admins can insert tournaments"
on public.tournaments
for insert
with check (
  exists (
    select 1 from public.profiles
    where profiles.id = auth.uid() and profiles.is_admin = true
  )
);

drop policy if exists "Admins can update tournaments" on public.tournaments;
create policy "Admins can update tournaments"
on public.tournaments
for update
using (
  exists (
    select 1 from public.profiles
    where profiles.id = auth.uid() and profiles.is_admin = true
  )
);

drop policy if exists "Admins can delete tournaments" on public.tournaments;
create policy "Admins can delete tournaments"
on public.tournaments
for delete
using (
  exists (
    select 1 from public.profiles
    where profiles.id = auth.uid() and profiles.is_admin = true
  )
);

-- =========================================
-- 2) registrations 테이블
-- =========================================
drop policy if exists "registrations_select_public" on public.registrations;
drop policy if exists "Public can view registrations" on public.registrations;

create policy "Authenticated users can view registrations"
on public.registrations
for select
using (auth.role() = 'authenticated');

-- 본인만 insert
drop policy if exists "Users can insert own registration" on public.registrations;
create policy "Users can insert own registration"
on public.registrations
for insert
with check (auth.uid() = user_id);

-- 본인 또는 관리자만 update
drop policy if exists "Users can update own registration" on public.registrations;
create policy "Users can update own registration"
on public.registrations
for update
using (
  auth.uid() = user_id
  or exists (
    select 1 from public.profiles
    where profiles.id = auth.uid() and profiles.is_admin = true
  )
);

-- 본인 또는 관리자만 delete
drop policy if exists "Users can delete own registration" on public.registrations;
create policy "Users can delete own registration"
on public.registrations
for delete
using (
  auth.uid() = user_id
  or exists (
    select 1 from public.profiles
    where profiles.id = auth.uid() and profiles.is_admin = true
  )
);

-- =========================================
-- 3) side_events 테이블 (Phase 3에서 생성된 테이블)
-- =========================================
drop policy if exists "side_events_select_public" on public.side_events;
drop policy if exists "Public can view side_events" on public.side_events;

create policy "Authenticated users can view side_events"
on public.side_events
for select
using (auth.role() = 'authenticated');

-- 관리자만 insert/update/delete
drop policy if exists "Admins can manage side_events" on public.side_events;
create policy "Admins can insert side_events"
on public.side_events
for insert
with check (
  exists (
    select 1 from public.profiles
    where profiles.id = auth.uid() and profiles.is_admin = true
  )
);

create policy "Admins can update side_events"
on public.side_events
for update
using (
  exists (
    select 1 from public.profiles
    where profiles.id = auth.uid() and profiles.is_admin = true
  )
);

create policy "Admins can delete side_events"
on public.side_events
for delete
using (
  exists (
    select 1 from public.profiles
    where profiles.id = auth.uid() and profiles.is_admin = true
  )
);

-- =========================================
-- 4) side_event_registrations 테이블
-- =========================================
drop policy if exists "side_event_registrations_select_public" on public.side_event_registrations;
drop policy if exists "Public can view side_event_registrations" on public.side_event_registrations;

create policy "Authenticated users can view side_event_registrations"
on public.side_event_registrations
for select
using (auth.role() = 'authenticated');

-- 본인만 insert
drop policy if exists "Users can insert own side_event_registration" on public.side_event_registrations;
create policy "Users can insert own side_event_registration"
on public.side_event_registrations
for insert
with check (auth.uid() = user_id);

-- 본인 또는 관리자만 update
drop policy if exists "Users can update own side_event_registration" on public.side_event_registrations;
create policy "Users can update own side_event_registration"
on public.side_event_registrations
for update
using (
  auth.uid() = user_id
  or exists (
    select 1 from public.profiles
    where profiles.id = auth.uid() and profiles.is_admin = true
  )
);

-- 본인 또는 관리자만 delete
drop policy if exists "Users can delete own side_event_registration" on public.side_event_registrations;
create policy "Users can delete own side_event_registration"
on public.side_event_registrations
for delete
using (
  auth.uid() = user_id
  or exists (
    select 1 from public.profiles
    where profiles.id = auth.uid() and profiles.is_admin = true
  )
);

-- =========================================
-- 5) tournament_files 테이블
-- =========================================
drop policy if exists "tournament_files_select_public" on public.tournament_files;
drop policy if exists "Public can view tournament_files" on public.tournament_files;

create policy "Authenticated users can view tournament_files"
on public.tournament_files
for select
using (auth.role() = 'authenticated');

-- 관리자만 insert/update/delete
drop policy if exists "Admins can manage tournament_files" on public.tournament_files;
create policy "Admins can insert tournament_files"
on public.tournament_files
for insert
with check (
  exists (
    select 1 from public.profiles
    where profiles.id = auth.uid() and profiles.is_admin = true
  )
);

create policy "Admins can update tournament_files"
on public.tournament_files
for update
using (
  exists (
    select 1 from public.profiles
    where profiles.id = auth.uid() and profiles.is_admin = true
  )
);

create policy "Admins can delete tournament_files"
on public.tournament_files
for delete
using (
  exists (
    select 1 from public.profiles
    where profiles.id = auth.uid() and profiles.is_admin = true
  )
);

-- =========================================
-- 6) profiles 테이블 (참고: 이미 인증 기반일 가능성 높음)
-- =========================================
-- profiles는 사용자가 자신의 프로필만 볼 수 있어야 함
drop policy if exists "Users can view own profile" on public.profiles;
create policy "Users can view own profile"
on public.profiles
for select
using (auth.uid() = id);

drop policy if exists "Users can update own profile" on public.profiles;
create policy "Users can update own profile"
on public.profiles
for update
using (auth.uid() = id);

-- 관리자는 모든 프로필 조회 가능 (선택사항)
drop policy if exists "Admins can view all profiles" on public.profiles;
create policy "Admins can view all profiles"
on public.profiles
for select
using (
  exists (
    select 1 from public.profiles p
    where p.id = auth.uid() and p.is_admin = true
  )
);

-- =========================================
-- 완료 메시지
-- =========================================
-- 이 마이그레이션 실행 후:
-- 1. 비로그인 사용자는 모든 데이터 조회 불가
-- 2. 로그인한 사용자는 대회/신청/라운드 정보 조회 가능
-- 3. 본인이 작성한 신청만 수정/삭제 가능
-- 4. 관리자는 모든 데이터 관리 가능
--
-- 주의: 이 스크립트는 기존 테스트 환경에서 먼저 실행하여 검증하세요.
