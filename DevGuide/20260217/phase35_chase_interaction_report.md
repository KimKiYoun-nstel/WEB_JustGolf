# Phase 3.5 실행 리포트 (체이스 연출 + 관리자 상호작용 선택)

## 1. 목표
- 랜덤 점프형 스캔을 제거하고, 한 방향 체이스 + 감속 중심 연출로 전환
- 관리자 상호작용(당첨자 뽑기 클릭) 시점에 현재 커서를 선택
- 상호작용이 없으면 연출 종료 시점 커서를 자동 선택
- 모든 시청자 화면에서 동일 결과를 보장

## 2. 구현 내용
### 2.1 연출 엔진 전환
- `lib/draw/animators/scoreboard/path.ts`
  - 랜덤 경로 생성 제거
  - 한 방향(+1) 연속 이동 + 후반 감속 타임라인 생성
  - `timelineMs` 기반 인덱스 해석 추가
  - 서버/클라이언트 공용 커서 해석 함수 추가:
    - `resolveScoreboardScanIndexAtElapsed`
    - `resolveScoreboardCursorIndex`
  - reveal은 왕복 없이 한 방향 수렴으로 변경

### 2.2 서버 선택 로직(동기화 핵심)
- `app/api/admin/tournaments/[id]/draw/route.ts`
  - `start_step` 패턴을 `scoreboard-chase-v1`로 설정
  - 기본 tempo를 체이스용으로 조정(`baseHz=10`, `nearMiss=0`)
  - `pick_result`에서 랜덤 선택 제거
  - 선택 규칙:
    - `cursorIndex`가 전달되면 해당 인덱스 선택
    - 미전달 시 서버가 `startedAt/seed/tempo/durationMs/atMs`로 커서 계산 후 선택
  - 결과적으로 `PICK_RESULT`는 단일 권위(서버) 결과를 브로드캐스트

### 2.3 관리자 상호작용 연결
- `app/admin/tournaments/[id]/draw/page.tsx`
  - `당첨자 뽑기` 클릭 시 현재 커서를 계산해 `cursorIndex` 전달
  - 자동 선택 타이머에서도 동일 계산 로직 사용
  - 기본 연출 시간 초기값을 `6500ms`로 상향

### 2.4 클라이언트 렌더 동기화
- `components/draw/scoreboard/ScoreboardAnimator.tsx`
  - 스캔 진행을 `progress 비례`가 아닌 `timelineMs 기반`으로 해석
  - 서버 계산 규칙과 동일한 인덱스 추적 방식 유지

### 2.5 시각 강조 강화(1차)
- `components/draw/scoreboard/CandidateCard.tsx`
- `components/draw/scoreboard/ScoreboardAnimator.tsx`
  - Active/Winner 강조 대비 강화
  - 배경 후보는 명도/채도 하향으로 층 분리
  - 상단 상태칩/레전드 강화

### 2.6 시각 강조 강화(2차, 완료 보강)
- `components/draw/scoreboard/CandidateCard.tsx`
  - Active/Winner 카드에 상단 컬러 바 + 비콘 점멸 추가
  - Active/Winner ring/배경 대비를 한 단계 상향해 모바일에서도 즉시 구분 가능하도록 조정
  - 번호 배지 색상을 톤별로 분리(Active/Winner/Near/Background)
- `components/draw/scoreboard/ScoreboardAnimator.tsx`
  - 상태칩/스테이지/프로그레스 바를 phase 기반 컬러 테마로 분기
  - `현재 포커스`(번호+닉네임) 칩을 상단에 고정 노출
  - 기본 fallback duration을 `6500ms`로 상향해 과속 체감 완화
- `components/draw/scoreboard/LowerThird.tsx`
  - LIVE/WINNER 배지 추가
  - phase별 컨테이너 톤 분리(스캔/픽/확정)
  - 현재 후보 텍스트 가중치 강화(굵기/크기 상향)

### 2.7 연출 의도 재반영(카드 뒤집힘 중심)
- `components/draw/scoreboard/CandidateCard.tsx`
  - 기본 상태를 카드 뒷면(닉네임 비공개)으로 고정
  - 현재 타겟/당첨 카드만 flip되어 닉네임 노출
  - 카드 번호 제거, 닉네임 중앙 정렬로 단순화
- `components/draw/scoreboard/CandidateGrid.tsx`
  - `near/trail/background` 3단 강조를 제거하고 `active/winner` 중심으로 단순화
- `components/draw/scoreboard/ScoreboardAnimator.tsx`
  - 상단 레전드를 `타겟 카드 공개 / 비타겟 카드 비공개` 방식으로 전환
  - stage 컬러 대비를 강하게 조정(타겟: amber, 확정: emerald, 비타겟: dark slate)
- `components/draw/scoreboard/LowerThird.tsx`
  - 하단 현재 후보 표기에서 번호 제거(닉네임 중심)

### 2.8 3차 보정(상하 flip + 종료 후 전체 오픈 + 덱 셔플 + PC 공간 최적화)
- `components/draw/scoreboard/CandidateCard.tsx`
  - flip 축을 좌우(`rotateY`)에서 상하(`rotateX`)로 변경
  - flip 속도를 저사양 `180ms`, 일반 `360ms`로 조정
  - 카드 뒷면/앞면 전환 조건에 `revealAll`을 추가
- `components/draw/scoreboard/ScoreboardAnimator.tsx`
  - `picked` 단계에서 winner lock 연출 후 `revealSettled` 시점에 전체 카드 오픈
  - `confirmed/finished/idle`에서 전체 카드 정보 공개, 다음 `configured` 시작 시 다시 뒷면
  - 수동 뽑기 시 winner와 현재 스캔 카드가 동시에 뜨는 문제를 lock 단계로 완화
- `app/api/admin/tournaments/[id]/draw/route.ts`
  - `start_step` 시 seed 기반 Fisher-Yates 셔플로 `deckOrder` 생성/저장
  - `pick_result`는 `deckOrder` 기준 인덱스로 서버 권위 선택
- `lib/draw/types.ts`, `lib/draw/reducer.ts`
  - `STEP_CONFIGURED.payload.deckOrder` 확장
  - `DrawState.stepDeckPlayerIds` 추가 및 이벤트 흐름별 상태 정규화
- `app/admin/tournaments/[id]/draw/page.tsx`, `app/t/[id]/draw/page.tsx`
  - 애니메이터 입력 후보 목록을 `stepDeckPlayerIds` 우선으로 렌더
  - 관리자 커서 계산도 동일 덱 기준으로 통일
- `app/admin/tournaments/[id]/layout.tsx`, `app/admin/tournaments/[id]/draw/page.tsx`
  - PC 기준 탭(앵커)을 타이틀 우측 동일 행으로 재배치
  - 헤더/카드 내부 패딩/간격 축소로 상하 여백 절감

### 2.9 시작 전 명시적 덱 셔플 기능 추가
- `app/api/admin/tournaments/[id]/draw/route.ts`
  - `shuffle_deck` 액션 추가
  - `configured/picked` 진행 중에는 셔플 금지, 그 외 상태에서 남은 후보 순서를 서버에서 섞어 저장
  - 세션의 `player_ids`를 갱신하여 관리자/시청자 모두 동일 순서를 공유
  - `start_step`은 이미 섞여 있는 현재 순서를 그대로 사용해 step을 시작
- `app/admin/tournaments/[id]/draw/page.tsx`
  - 진행 컨트롤에 `덱 섞기` 버튼 추가
  - 스텝 시작 전(비진행 상태) 클릭으로 즉시 다음 추첨 덱 순서를 갱신

### 2.10 덱 섞기 시각 연출 추가
- `components/draw/scoreboard/ScoreboardAnimator.tsx`
  - 후보 순서 변경(동일 인원 수 유지)을 감지하면 `DECK SHUFFLE` 연출 실행
  - 약 0.8~0.9초 동안 커서가 빠르게 순환하고 카드가 비공개 상태로 전환
  - 연출 종료 후 셔플된 순서로 카드가 다시 공개되어 “섞임”을 시각적으로 확인 가능
  - 관리자/시청자 모두 동일하게 연출을 받음(같은 순서 변경을 감지)

### 2.11 모바일/시청자 조기 확정 동기화 이슈 보정
- `lib/draw/reducer.ts`
  - `PICK_RESULT`는 해당 step의 `configured` 상태에서만 적용되도록 가드 추가
  - `ASSIGN_UPDATED`, `ASSIGN_CONFIRMED`도 `picked` 단계 + 동일 player 조건으로만 적용
  - out-of-order 수신 시 조기 확정처럼 보이는 케이스 방지
- `app/t/[id]/draw/page.tsx`
  - 폴링 주기를 2.5초에서 1초로 단축해 실시간 복구 속도 개선
  - `draw_events UPDATE` 구독을 추가해 이벤트 payload 수정(예: 덱 셔플 반영)을 즉시 반영
- `app/admin/tournaments/[id]/draw/page.tsx`
  - 관리자 화면도 `draw_events UPDATE` 구독 추가
- `lib/draw/reducer.test.ts`
  - `STEP_CONFIGURED` 이전 `PICK_RESULT` 무시 시나리오 테스트 추가

## 3. 검증 결과
- 단위 테스트:
  - `npm run test -- lib/draw/animators/scoreboard/path.test.ts lib/draw/reducer.test.ts`
  - 통과
- 빌드:
  - `npm run build`
  - 통과
- E2E:
  - `DRAW_FIXTURE_COUNT=17`
  - `npx playwright test e2e/live-draw-verify.spec.ts --project=chromium`
  - 통과
- 재검증(시각 강조 2차 보강 후):
  - `npx eslint components/draw/scoreboard/CandidateCard.tsx components/draw/scoreboard/ScoreboardAnimator.tsx components/draw/scoreboard/LowerThird.tsx`
  - `npm run test -- lib/draw/animators/scoreboard/path.test.ts lib/draw/reducer.test.ts`
  - `npm run build`
  - `DRAW_FIXTURE_COUNT=17; npx playwright test e2e/live-draw-verify.spec.ts --project=chromium`
  - 모두 통과
- 재검증(카드 뒤집힘 반영 후):
  - `npx eslint components/draw/scoreboard/CandidateCard.tsx components/draw/scoreboard/CandidateGrid.tsx components/draw/scoreboard/ScoreboardAnimator.tsx components/draw/scoreboard/LowerThird.tsx`
  - `npm run test -- lib/draw/animators/scoreboard/path.test.ts lib/draw/reducer.test.ts`
  - `npm run build`
  - `DRAW_FIXTURE_COUNT=17; npx playwright test e2e/live-draw-verify.spec.ts --project=chromium`
  - 모두 통과
- 재검증(3차 보정 반영 후):
  - `npx eslint lib/draw/types.ts lib/draw/reducer.ts app/api/admin/tournaments/[id]/draw/route.ts app/admin/tournaments/[id]/draw/page.tsx app/admin/tournaments/[id]/layout.tsx app/t/[id]/draw/page.tsx components/draw/scoreboard/CandidateCard.tsx components/draw/scoreboard/CandidateGrid.tsx components/draw/scoreboard/ScoreboardAnimator.tsx`
  - `npm run test -- lib/draw/animators/scoreboard/path.test.ts lib/draw/reducer.test.ts`
  - `npm run build`
  - `DRAW_FIXTURE_COUNT=17; npx playwright test e2e/live-draw-verify.spec.ts --project=chromium`
  - 모두 통과
- 재검증(시작 전 덱 섞기 기능 추가 후):
  - `npx eslint app/api/admin/tournaments/[id]/draw/route.ts app/admin/tournaments/[id]/draw/page.tsx`
  - `npm run test -- lib/draw/animators/scoreboard/path.test.ts lib/draw/reducer.test.ts`
  - `npm run build`
  - `DRAW_FIXTURE_COUNT=17; npx playwright test e2e/live-draw-verify.spec.ts --project=chromium`
  - 모두 통과
- 재검증(덱 셔플 시각 연출 추가 후):
  - `npx eslint components/draw/scoreboard/ScoreboardAnimator.tsx components/draw/scoreboard/CandidateCard.tsx`
  - `npm run test -- lib/draw/animators/scoreboard/path.test.ts lib/draw/reducer.test.ts`
  - `npm run build`
  - `DRAW_FIXTURE_COUNT=17; npx playwright test e2e/live-draw-verify.spec.ts --project=chromium`
  - 모두 통과
- 재검증(동기화 보정 후):
  - `npx eslint lib/draw/reducer.ts lib/draw/reducer.test.ts app/t/[id]/draw/page.tsx app/admin/tournaments/[id]/draw/page.tsx`
  - `npm run test -- lib/draw/animators/scoreboard/path.test.ts lib/draw/reducer.test.ts`
  - `npm run build`
  - `DRAW_FIXTURE_COUNT=17; npx playwright test e2e/live-draw-verify.spec.ts --project=chromium`
  - 모두 통과
- 리포트:
  - `artifacts/live-draw/20260217_161830/report.json`
  - `artifacts/live-draw/20260217_191815/report.json`

## 4. 결론
- 연출 템포가 “랜덤 점프”에서 “예측 가능한 한 방향 체이스”로 전환되어 기대감이 개선됨
- 관리자 상호작용 여부와 무관하게 서버가 최종 선택을 결정하므로 동기화 안정성 확보
- 모바일/시청자 화면까지 포함해 동일 결과와 상태 표현을 유지함
- 후보 강조 대비(색상/배지/비콘)를 추가 상향해 “현재 대상 식별성” 문제를 해소했으며, **Phase 3.5 완료**로 판정
