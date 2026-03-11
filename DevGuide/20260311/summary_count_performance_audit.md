# 요약 카운팅 성능 점검 및 개선안 (2026-03-11)

## 1) 요구사항
- 여러 페이지에서 참가자/라운드 관련 요약 카운트를 표시할 때, 데이터 누적(대회 수/참가자 수 증가) 이후에도 응답/렌더 성능을 유지한다.
- 점검 범위:
  - 사용자: `/tournaments`, `/t/[id]`, `/t/[id]/participants`
  - 관리자: `/admin/tournaments/[id]/dashboard`, `/admin/tournaments/[id]/registrations`, `/admin/tournaments/[id]/side-events`

## 2) 영향 파일 (핵심)
- `app/tournaments/page.tsx`
- `app/t/[id]/page.tsx`
- `app/t/[id]/participants/page.tsx`
- `app/admin/tournaments/[id]/dashboard/page.tsx`
- `app/admin/tournaments/[id]/registrations/page.tsx`
- `app/admin/tournaments/[id]/side-events/page.tsx`
- `db/migrations/033_registrations_tournament_status_index.sql`
- `db/migrations/036_registration_count_by_tournament.sql`

## 3) 데이터/권한(RLS) 영향 점검
- 현재 `registrations`는 `Authenticated users can view registrations` 정책으로 인증 사용자 전체 조회가 가능함.
- 성능 개선을 위해 집계 RPC를 추가할 경우:
  - 가능한 `SECURITY INVOKER` + 기존 RLS 준수
  - 관리자 전용 집계는 `can_manage_tournament`/`can_manage_side_events` 조건을 함수 내부에서 강제
  - Service Role 사용 없이 집계 결과만 반환하는 구조를 우선

## 4) 현재 병목 패턴 (정적 점검)

### P0 (우선 개선)
1. N+1 조회
- `app/admin/tournaments/[id]/side-events/page.tsx`
- side event 목록 조회 후, 각 side event마다 `side_event_registrations`를 개별 조회(루프 내부 await)
- 대회당 라운드 수가 늘수록 요청 수가 선형 증가

2. 대량 행 전체 조회 + 클라이언트 집계
- `app/tournaments/page.tsx`
- 대회 목록 요약을 위해 `registrations`를 다건 조회한 뒤 클라이언트에서 pre/post 희망 카운트 계산
- 대회 수/누적 신청 수 증가 시 네트워크 전송량 증가

### P1 (중요)
3. 관리자 신청자 페이지 전체 로드
- `app/admin/tournaments/[id]/registrations/page.tsx`
- 신청자 목록 + 활동 선택 조인 데이터를 전체 조회 후 클라이언트 필터/집계
- 데이터 증가 시 초기 로딩 시간과 메모리 사용량 증가

4. 참가자 공개 페이지 전체 로드
- `app/t/[id]/participants/page.tsx`
- registrations + extras + activity selections + side event registrations를 일괄 로드
- 카드/테이블 양쪽 렌더로 클라이언트 비용 증가

5. 관리자 대시보드 상태 집계 클라이언트 계산
- `app/admin/tournaments/[id]/dashboard/page.tsx`
- registrations 전체 조회 후 상태별 필터 카운트

### P2 (보완)
6. 인덱스 미흡 가능성
- `side_events(tournament_id)` 인덱스 없음
- `side_event_registrations(side_event_id)` 일반 인덱스 없음
  - 현재 `(side_event_id, registration_id) WHERE status <> 'canceled'` partial index만 존재
  - canceled 포함 조회/관리자 이력 조회에서는 인덱스 효율 저하 가능

## 5) 개선 전략 (누적 데이터 대응)

### 단기 (즉시 적용, 1~2일)
1. N+1 제거
- side-events 관리자 페이지를 `.in(side_event_id, [...])` 단일 조회로 변경

2. 독립 쿼리 병렬화
- 페이지 초기 로딩에서 상호 의존 없는 쿼리는 `Promise.all`로 병렬 처리
- 체감 latency 단축

3. payload 최소화
- 요약 전용 카드에는 요약에 필요한 컬럼만 조회
- 상세 테이블 데이터는 탭/섹션 진입 시 lazy load

### 중기 (1주)
4. 집계 RPC 확장
- 상태/희망 카운트/라운드별 신청 수를 DB 집계 함수로 이관
- 프런트는 집계 결과만 수신

5. 서버사이드 페이징 도입
- 관리자 신청자/참가자 페이지: offset/limit 또는 cursor 기반
- 요약은 별도 집계 API로 분리

6. 인덱스 보강
- `side_events (tournament_id, round_type, id)`
- `side_event_registrations (side_event_id, status, id)`
- 쿼리패턴 기반으로 `EXPLAIN (ANALYZE, BUFFERS)` 검증 후 확정

### 장기 (2주+)
7. 사전 집계 테이블(증분 업데이트)
- `tournament_metrics`/`side_event_metrics` 테이블 운영
- registrations/side_event_registrations 변경 트리거로 카운터 증분 반영
- 조회 O(1)화로 데이터 누적에도 응답 시간 안정화

8. 캐싱 전략
- 서버 Route Handler + revalidate tag 기반 캐시
- 관리자 화면은 짧은 TTL, 사용자 공개 요약은 긴 TTL

## 6) 권장 구현 순서 (Phase)
1. Phase A: side-events N+1 제거 + 쿼리 병렬화
2. Phase B: 집계 RPC 2~3개 추가 (상태/희망/라운드)
3. Phase C: 관리자 대용량 페이지 페이징/지연 로딩
4. Phase D: 지표 기반으로 summary table 도입 여부 결정

## 7) 성능 유지 확인 지표
- 페이지별 summary 로딩 쿼리 수
  - 목표: 사용자 목록 3~4개 이하, 관리자 상세 4~6개 이하
- 요약 데이터 payload 크기
  - 목표: 100~200KB 이내 유지
- DB 집계 p95
  - 목표: 100ms~200ms 내
- 초기 렌더(요약 카드 표시) p95
  - 목표: 1초 내

## 8) 즉시 실행 체크리스트
- [ ] side-events 페이지 N+1 제거
- [ ] `side_events`, `side_event_registrations` 인덱스 추가 SQL 초안 작성
- [ ] round preference 집계 RPC 설계
- [ ] 관리자 registrations 페이지 페이징 설계
- [ ] 스테이징 데이터(대회 100+, registrations 10만+)로 부하 테스트 시나리오 정의
