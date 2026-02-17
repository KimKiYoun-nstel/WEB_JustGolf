# Phase 2 실행 리포트 (방식1 코어 모션 구현)

## 1. 목표
- 방식1(전광판 하이라이트)의 핵심 모션(스캔/가감속/near-miss/수렴)을 실제 코드로 구현
- 관리자/시청자 화면에서 `scoreboard` 애니메이터로 전환
- `N명(가변)` 후보 수를 그대로 처리할 수 있는 경로 생성/렌더 구조 확보

## 2. 적용 내용
### 2.1 전광판 모션 엔진 추가
- `lib/draw/animators/scoreboard/path.ts`
  - seed 기반 스캔 경로 생성: `buildScoreboardScanPath`
  - near-miss 수렴 경로 생성: `buildScoreboardRevealPath`
  - tempo 보정/클램프: `normalizeScoreboardTempo`
  - seed 파생 유틸: `deriveDrawSeed`

### 2.2 전광판 UI 컴포넌트 추가
- `components/draw/scoreboard/ScoreboardAnimator.tsx`
- `components/draw/scoreboard/CandidateGrid.tsx`
- `components/draw/scoreboard/CandidateCard.tsx`
- `components/draw/scoreboard/LowerThird.tsx`

구현 포인트:
- 전원 후보 슬롯 유지 + Active/Near-Miss/Background 계층 표현
- 하단 자막(`번호 + 닉네임`, 타겟 조, 남은 후보) 고정 노출
- `PICK_RESULT` 수신 시 winner 수렴 애니메이션 실행
- 모바일에서도 동일 DOM 구조로 동작(강조 계층 중심)

### 2.3 이벤트 payload 연계 확장
- `STEP_CONFIGURED` payload에 애니메이션 파라미터 포함:
  - `seed`, `pattern`, `tempo`
- 적용 파일:
  - `app/api/admin/tournaments/[id]/draw/route.ts`
  - `lib/draw/types.ts`
  - `lib/draw/reducer.ts`
  - `lib/draw/animators/Animator.ts`

### 2.4 화면 연결 전환
- `components/draw/DrawAnimator.tsx`에서 `kind="scoreboard"` 실제 구현체 연결
- 관리자/시청자 페이지를 scoreboard 모드로 전환:
  - `app/admin/tournaments/[id]/draw/page.tsx`
  - `app/t/[id]/draw/page.tsx`

### 2.5 E2E 보강
- 캔버스 의존 검증을 stage 기반 검증으로 변경
- 액션 트리거를 UI 클릭 + 관리자 API 호출 조합으로 안정화
- 적용 파일:
  - `e2e/live-draw-verify.spec.ts`
  - `scripts/verify-live-draw-playwright.mjs`

## 3. 테스트 결과
### 3.1 단위 테스트
- 실행:
  - `npm run test -- lib/draw/animators/scoreboard/path.test.ts lib/draw/reducer.test.ts`
- 결과: 통과 (11/11)

### 3.2 빌드
- 실행:
  - `npm run build`
- 결과: 통과

### 3.3 E2E 스모크
- 실행:
  - `DRAW_FIXTURE_COUNT=17`
  - `npx playwright test e2e/live-draw-verify.spec.ts --project=chromium`
- 결과: 통과
- 산출물:
  - `artifacts/live-draw/20260217_151627/report.json`
  - 관리자/시청자(데스크톱)/시청자(모바일) 단계별 스크린샷 일괄 저장

## 4. 현재 완성도 평가 (Phase 2 관점)
- 기능 완성도:
  - 방식1 핵심 애니메이션(스캔/수렴) 동작 확보
  - 가변 후보 수 처리 가능
  - 실시간/리플레이 흐름 내 동작 확인
- UI 완성도:
  - Active 후보 식별성과 하단 자막 가독성은 요구 수준 충족
  - 배경 후보의 시각적 밀도/타이포 미세조정 여지는 남음(Phase 3에서 마감)

## 5. 잔여 작업 (Phase 3)
- 모바일 정보 밀도 튜닝(배경 후보 축약 규칙, 폰트 스케일 미세조정)
- 하단 자막/상단 상태 배지의 방송 그래픽 스타일 일관화
- 저사양 모드 시각 효과 감축 폭 보정
