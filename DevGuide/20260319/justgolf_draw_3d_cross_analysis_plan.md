# JustGolf 조추첨 3D 업그레이드 문서-코드 교차분석

## 1) 요구사항 요약
- 목표: 기존 draw 결과 결정 로직은 유지하고, 연출 레이어만 `stage3d` 구현체로 확장.
- 범위: viewer/admin draw 화면의 애니메이터 계층, lowSpec 분기, replay/실시간 동기화 일관성.
- 비범위: draw DB 스키마 대규모 변경, reducer 전면 재작성, 실시간 구독 구조 변경, pick/assign 의미 변경.
- 핵심 원칙:
  - 결과 결정(서버/이벤트)과 결과 표현(3D/HUD) 분리
  - 3D Scene과 2D HUD 분리
  - viewer/admin는 동일 draw state를 서로 다른 목적(UI)으로 표시
  - deterministic timeline 재생(재접속 replay 동일성)

## 2) 현재 코드와의 정합성(맞는 점)
- 이벤트 소싱 + 리플레이 기반 상태 계산이 이미 존재.
  - `replayDrawEvents`로 viewer/admin 모두 동일 state를 계산함.
  - 근거: `app/t/[id]/draw/page.tsx:474`, `app/admin/tournaments/[id]/draw/page.tsx:357`
- 애니메이터 교체 호스트 구조(`DrawAnimator`)가 이미 존재.
  - 근거: `components/draw/DrawAnimator.tsx:7`
- draw step deterministic 입력값(seed/tempo/deckOrder/duration/startedAt)을 서버 이벤트에 기록 중.
  - 근거: `app/api/admin/tournaments/[id]/draw/route.ts:1077`, `app/api/admin/tournaments/[id]/draw/route.ts:1078`, `app/api/admin/tournaments/[id]/draw/route.ts:1079`, `app/api/admin/tournaments/[id]/draw/route.ts:1080`, `app/api/admin/tournaments/[id]/draw/route.ts:1082`, `app/api/admin/tournaments/[id]/draw/route.ts:1083`
- 저사양 모드 플래그가 viewer/admin 모두 존재하고 AnimatorProps로 전달됨.
  - 근거: `app/t/[id]/draw/page.tsx:120`, `app/t/[id]/draw/page.tsx:817`, `app/admin/tournaments/[id]/draw/page.tsx:184`, `app/admin/tournaments/[id]/draw/page.tsx:1123`
- 실시간 publication 및 RLS 기초가 준비되어 있어 3D 도입 자체로 DB 확장은 필수 아님.
  - 근거: `db/migrations/031_draw_realtime_publication.sql:19`, `db/migrations/031_draw_realtime_publication.sql:29`

## 3) 문서 대비 갭/리스크(불일치)
### 3.1 Animator Kind 확장 미구현
- 현재 `DrawAnimatorKind`는 `"lotto" | "scoreboard"`만 허용.
  - 근거: `lib/draw/animators/Animator.ts:3`
- `DrawAnimator`도 scoreboard/lotto 분기만 존재.
  - 근거: `components/draw/DrawAnimator.tsx:8`, `components/draw/DrawAnimator.tsx:12`
- viewer/admin 페이지가 모두 `kind="scoreboard"` 고정.
  - 근거: `app/t/[id]/draw/page.tsx:794`, `app/admin/tournaments/[id]/draw/page.tsx:1100`

### 3.2 상세설계의 파일 경로 일부 불일치
- 문서에 언급된 `components/draw/types.ts`는 현재 없음.
- 실제 계약 타입은 `lib/draw/animators/Animator.ts`가 소유.

### 3.3 Phase 모델 정합성 이슈
- 상세설계는 `assigning`, `assign_update/assign_confirm` 중심 phase 매핑을 제안.
- 실제 `DrawPhase`는 `idle/configured/spinning/picked/confirmed/finished`.
  - 근거: `lib/draw/types.ts:5`
- reducer도 `confirmed`로 수렴하며 `assigning` phase는 없음.
  - 근거: `lib/draw/reducer.ts:275`, `lib/draw/reducer.ts:298`
- 따라서 Stage3D 설계 시 내부 `StagePhase`와 현재 `DrawPhase` 매핑 테이블을 명시적으로 두지 않으면 오해 가능.

### 3.4 서버 로직의 scoreboard 결합도
- API는 step pattern을 `"scoreboard-chase-v1"`로 고정 기록.
  - 근거: `app/api/admin/tournaments/[id]/draw/route.ts:1081`
- pick_result 계산도 scoreboard path 함수를 직접 사용.
  - 근거: `app/api/admin/tournaments/[id]/draw/route.ts:1106`, `lib/draw/animators/scoreboard/path.ts:181`
- 3D 도입 시에도 결과 결정 로직은 유지 가능하지만, 명칭/유틸 책임 분리를 안 하면 향후 연출 다형성에서 혼선.

### 3.5 테스트 결합도(대형 리스크)
- E2E가 `draw-scoreboard-*` test id와 텍스트를 강하게 가정.
  - 근거: `tests/e2e/live-draw-verify.spec.ts:214`, `tests/e2e/live-draw-verify.spec.ts:256`, `tests/e2e/live-draw-verify.spec.ts:483`
- 즉 `stage3d` 기본 전환 시 기존 E2E 대량 실패 가능성이 매우 높음.

### 3.6 패키지 준비 상태
- 현재 의존성은 Pixi 중심이며, 제안된 3D 스택 미설치.
  - 근거: `package.json:28` (`pixi.js` 존재)

## 4) 영향 파일(우선순위 기준)
### 4.1 필수 수정
- `lib/draw/animators/Animator.ts`
  - `DrawAnimatorKind`에 `"stage3d"` 추가
  - 필요 시 optional prop(`presentationMode`, `themeVariant`) 검토
- `components/draw/DrawAnimator.tsx`
  - `stage3d` 분기 + dynamic import(`ssr:false`)
- `app/t/[id]/draw/page.tsx`
  - `kind` 선택 로직을 feature flag 기반으로 분기
- `app/admin/tournaments/[id]/draw/page.tsx`
  - 동일하게 feature flag 분기 + admin presentation 모드 전달 검토

### 4.2 신규 추가(문서 제안 핵심)
- `components/draw/stage3d/**` 일체
  - `Stage3DAnimator`, `StageCanvas`, `StageScene`, `HudOverlay`
  - `hooks/useStageTimeline`, `hooks/useStageSceneState`, `hooks/usePerformanceTier`
  - `lib/mapAnimatorPropsToStageState`, `lib/computeTimelineProgress`, `lib/computePhaseDirectives`

### 4.3 연관 검토
- `app/api/admin/tournaments/[id]/draw/route.ts`
  - 결과 결정 로직 자체 변경은 금지
  - 다만 scoreboard 명칭 결합(패턴명/헬퍼명) 정리 필요 여부 검토
- `tests/e2e/live-draw-verify.spec.ts`
  - `stage3d` 도입 시 선택자/검증 기준 이원화 필요

## 5) 데이터/권한(RLS) 영향
### 5.1 RLS 영향
- 3D 애니메이터 추가 자체로 DB 정책 변경 필요 없음.
- 기존 draw/read/write 정책을 유지하면 됨.
  - draw RLS 근거: `db/migrations/030_live_group_draw_sessions_and_events.sql:71`, `db/migrations/030_live_group_draw_sessions_and_events.sql:83`, `db/migrations/030_live_group_draw_sessions_and_events.sql:104`
  - draw chat RLS 근거: `db/migrations/035_live_draw_chat_sessions_and_messages.sql:64`, `db/migrations/035_live_draw_chat_sessions_and_messages.sql:77`, `db/migrations/035_live_draw_chat_sessions_and_messages.sql:99`

### 5.2 관리자/일반 사용자/비로그인 플로우
- 비로그인:
  - draw/chat API는 `requireApiUser()`로 차단.
- 일반 인증 사용자:
  - viewer에서 draw_sessions/events read 및 chat read 가능.
- 관리자:
  - draw 제어 API는 `requireApiUser({ requireAdmin: true })` + 서버 Service Role로 실행.
  - session 활성화(start/reset)는 상위 관리자 제한 로직 존재.
  - 근거: `app/api/admin/tournaments/[id]/draw/route.ts:543`, `app/api/admin/tournaments/[id]/draw/route.ts:552`

### 5.3 Service Role 경계
- 현재 구조는 Route Handler 내부에서만 Service Role 사용.
- `stage3d` 도입 시 클라이언트에 Service Role 관련 코드/키가 전파되지 않도록 기존 경계를 유지해야 함.

## 6) 테스트 전략
### 6.1 단위 테스트
- 신규 pure 함수 테스트:
  - `mapAnimatorPropsToStageState`
  - `computeTimelineProgress`
  - `computePhaseDirectives`
  - `buildRingLayout`
  - `computeCameraShot`
- 중점:
  - 같은 입력에서 동일 출력(deterministic)
  - phase 매핑 경계값
  - 후보 수 대량(20~120) 성능/레이아웃 안정성

### 6.2 통합 테스트
- viewer/admin가 같은 시점에 같은 winner/active를 재생하는지 검증
- 중간 접속 replay 동기화 검증
- lowSpec on/off 전환 시 state 불일치 없는지 검증

### 6.3 E2E 전환 전략(필수)
- 기존 `live-draw-verify.spec.ts`는 scoreboard 선택자에 강결합되어 있으므로:
  - (권장) feature flag 기반 A/B 실행
  - (또는) 공통 계약 test id(`draw-animator-stage-wrap`, `draw-focus`, `draw-candidate`)로 추상화
- stage3d 기본 전환 전에 scoreboard 경로 회귀 테스트를 반드시 유지.

## 7) 단계별 구현 계획(코드 현실 반영)
### Phase 0: 계약 정렬
- `DrawAnimatorKind` 확장
- `DrawPhase -> StagePhase` 명시 매핑 유틸 작성
- feature flag 도입(기본 off)

### Phase 1: 최소 통합
- `DrawAnimator`에 `stage3d` 분기 추가(동적 import)
- `Stage3DAnimator`/`StageCanvas` 최소 뼈대
- viewer/admin 둘 다 플래그 on 시 렌더 확인

### Phase 2: 상태/타임라인 일치
- `mapAnimatorPropsToStageState` + `useStageTimeline` 구현
- configured/picked/confirmed 기준 핵심 연출 우선 구현
- replay 진입 시점 일치 검증

### Phase 3: UX 확장
- HUD/LowerThird/StatusBadgeBar
- admin 디버그 오버레이(플래그 기반)
- lowSpec/mobile fallback 정책 확정

### Phase 4: 안정화
- E2E 계약 추상화 및 병행 테스트
- 성능 튜닝(티어별 옵션)
- 기본값 전환(stage3d on) 여부 결정

## 8) 스펙 확인/결정 필요 항목
- `stage3d`의 기본 활성화 시점:
  - 즉시 기본값 전환 vs feature flag 점진 롤아웃
- lowSpec 정책:
  - `stage3d-low` 유지 vs 자동 `scoreboard` fallback
- 테스트 계약:
  - scoreboard 전용 test id 유지 vs draw 공통 test id로 재정의
- API 패턴명:
  - `scoreboard-chase-v1` 유지 여부(의미상 중립화 필요 여부)

## 9) 구현 착수 체크리스트
- [ ] `DrawAnimatorKind` 확장안 확정
- [ ] `DrawPhase -> StagePhase` 매핑표 확정
- [ ] feature flag 키/기본값 확정
- [ ] stage3d 최소 스켈레톤 렌더 성공
- [ ] viewer/admin 동기화 스모크 통과
- [ ] `npm run build` 통과
- [ ] E2E 전환 계획(기존 scoreboard 회귀 포함) 합의
