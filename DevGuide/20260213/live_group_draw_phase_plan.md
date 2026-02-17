# 라이브 조편성 구현 Phase 계획

## 원칙
- 한 Phase 완료 후 다음 Phase로 이동
- 각 Phase는 "산출물 + 검증 기준"을 충족해야 완료 처리
- v1 범위는 룰렛 기반 라이브 추첨 + 이벤트 리플레이 + 관리자 확정 흐름

## Phase 목록

### Phase 1: 데이터/코어 기반
- 상태: 완료
- 산출물:
  - `draw_sessions`, `draw_events` 마이그레이션 + RLS
  - 이벤트 리플레이 reducer(`lib/draw/reducer.ts`)
  - 타입 정의(`lib/draw/types.ts`)
  - reducer 단위 테스트
- 검증 기준:
  - 이벤트 순차 적용 시 `remaining`, `groups`, `phase`가 일관되게 계산됨
  - 중복 확정 이벤트에도 상태가 깨지지 않음(idempotent)

### Phase 2: 시청자 페이지
- 상태: 완료
- 산출물:
  - `/t/[id]/draw` 페이지
  - 세션/이벤트 조회 + 리플레이 렌더
  - Realtime 구독(`postgres_changes`) 반영
- 검증 기준:
  - 늦게 진입한 시청자도 현재 상태 복원 가능

### Phase 3: 진행자 페이지 + API
- 상태: 완료
- 산출물:
  - `/admin/tournaments/[id]/draw` 페이지
  - 진행 제어 API(Route Handler)
  - `STEP_CONFIGURED`, `PICK_RESULT`, `ASSIGN_CONFIRMED` 발행
- 검증 기준:
  - 관리자만 진행 이벤트 발행 가능
  - ROUND_ROBIN / TARGET_GROUP 동작

### Phase 4: 룰렛 애니메이션
- 상태: 완료(v1 경량 애니메이터)
- 산출물:
  - `react-custom-roulette` 연동
  - `startedAt`, `durationMs` 기반 동기화 재생
  - 카드 이동 연출(CSS transform)
- 검증 기준:
  - 진행자/시청자 화면 흐름이 동일하게 보임

### Phase 5: 기존 조편성 테이블 동기화
- 상태: 완료(배정 확정 시 동기화)
- 산출물:
  - 라이브 확정 결과를 `tournament_groups*`에 반영
  - 기존 `/groups` 페이지와 결과 일치
- 검증 기준:
  - 라이브 종료 후 기존 조편성 화면에서도 동일 결과 확인 가능

### Phase 6: 운영 보강(선택)
- 상태: 완료(v1)
- 산출물:
  - `UNDO_LAST`, 재편성, 저사양 모드
  - 권한 확장(필요 시 대회별 매니저)
- 검증 기준:
  - 운영 정책에 맞는 제한/추적 가능

## 이번 작업 범위
- Phase 1~5까지 진행
