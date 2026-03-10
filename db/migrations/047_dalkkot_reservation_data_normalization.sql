-- Migration: 047_dalkkot_reservation_data_normalization.sql
-- Purpose:
--   1) 마이그레이션/수기 입력 과정에서 잘못 저장된 방문 상태 정규화
--   2) 미래/진행 전 예약의 checked_in_at / checked_out_at 제거
--   3) 비확정 예약(pending/waiting_deposit/rejected/cancelled)의 방문 상태 초기화
-- Date: 2026-03-10
--
-- 본 SQL은 Supabase SQL Editor에서 수동 실행합니다.

-- ============================================================================
-- 1) 미래/진행 전 예약은 방문 상태를 not_checked로 고정
-- ============================================================================

update public.dalkkot_reservations r
set
  visit_status = 'not_checked',
  checked_in_at = null,
  checked_out_at = null
where r.check_in >= current_date
  and (
    r.visit_status <> 'not_checked'
    or r.checked_in_at is not null
    or r.checked_out_at is not null
  );

-- ============================================================================
-- 2) 비확정 상태 예약은 방문 상태를 not_checked로 고정
-- ============================================================================

update public.dalkkot_reservations r
set
  visit_status = 'not_checked',
  checked_in_at = null,
  checked_out_at = null
where r.status in ('pending', 'waiting_deposit', 'rejected', 'cancelled')
  and (
    r.visit_status <> 'not_checked'
    or r.checked_in_at is not null
    or r.checked_out_at is not null
  );

-- ============================================================================
-- 3) 점검용 조회 (수동 확인)
-- ============================================================================
-- select count(*) as future_or_not_confirmed_dirty
-- from public.dalkkot_reservations r
-- where (
--   r.check_in >= current_date
--   or r.status in ('pending', 'waiting_deposit', 'rejected', 'cancelled')
-- )
-- and (
--   r.visit_status <> 'not_checked'
--   or r.checked_in_at is not null
--   or r.checked_out_at is not null
-- );