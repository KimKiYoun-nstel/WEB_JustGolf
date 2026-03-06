-- 036_registration_count_by_tournament.sql
-- DB에서 직접 집계하여 대회별 참가자 수를 효율적으로 조회하는 함수

-- 대회별 참가자 상태 집계 함수
CREATE OR REPLACE FUNCTION public.get_registration_counts_by_tournaments(tournament_ids bigint[])
RETURNS TABLE (
  tournament_id bigint,
  status text,
  count bigint
)
LANGUAGE sql
STABLE
AS $$
  SELECT 
    r.tournament_id,
    r.status,
    COUNT(*) as count
  FROM public.registrations r
  WHERE r.tournament_id = ANY(tournament_ids)
    AND r.status IN ('applied', 'approved', 'waitlisted', 'canceled')
  GROUP BY r.tournament_id, r.status
  ORDER BY r.tournament_id, r.status;
$$;

COMMENT ON FUNCTION public.get_registration_counts_by_tournaments IS '대회 ID 목록을 받아 각 대회별 상태별 참가자 수를 집계하여 반환 (네트워크 전송량 최소화)';

-- RLS: 누구나 조회 가능 (registrations 테이블의 SELECT 정책을 따름)
-- 함수는 STABLE이고 public schema이므로 별도 권한 설정 불필요
