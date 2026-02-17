# Phase 3 실행 리포트 (UI 조립 및 상태 연결)

## 1. 목표
- 방식1 전광판 애니메이터를 관리자/시청자 화면 흐름에 맞게 마감
- 모바일 가독성(전원 슬롯 유지 + 현재 후보 식별성) 강화
- 저사양 모드에서 효과를 축소하되 동일한 진행 플로우 유지

## 2. 적용 내용
### 2.1 전광판 시각 계층 강화
- `components/draw/scoreboard/CandidateCard.tsx`
  - Active/Near/Trail/Background 스타일 대비 강화
  - 후보 수가 많은 경우(`denseMode`) 모바일 텍스트 밀도 축소
  - 저사양 모드에서 불필요한 트랜지션 축소
- `components/draw/scoreboard/CandidateGrid.tsx`
  - 후보 수 기반 `denseMode` 도입(대규모 인원 대응)

### 2.2 하단 자막/상태바 일관성 보강
- `components/draw/scoreboard/LowerThird.tsx`
  - phase별 상태 문구 톤 분리
  - 현재 후보 라인에 `data-testid` 부여(모바일 가독성 검증용)
- `components/draw/scoreboard/ScoreboardAnimator.tsx`
  - 상단 상태 칩(`LIVE SCAN`, `pattern`, `mode`, `target`, `count`) 추가
  - 레전드(현재/근접/배경 후보) 추가
  - 저사양 모드에서 tempo 자동 감축(`baseHz`, `nearMiss`, `slowdownMs`)

### 2.3 모바일 하단 패널 접기/펼치기
- `app/admin/tournaments/[id]/draw/page.tsx`
- `app/t/[id]/draw/page.tsx`
  - 모바일(`max-width: 1023px`)에서 기본 접힘
  - 조 편성 현황/남은 추첨 대상 패널 개별 토글 제공
  - 데스크톱에서는 항상 펼침 유지

### 2.4 E2E 검증 강화
- `e2e/live-draw-verify.spec.ts`
  - 모바일에서 후보 전원 슬롯 수 검증 추가
  - 모바일 현재 후보 라인 가독성 검증 추가
  - 모바일 Active/Winner 후보 가시성 검증 추가

## 3. 테스트 결과
### 3.1 단위 테스트
- `npm run test -- lib/draw/animators/scoreboard/path.test.ts lib/draw/reducer.test.ts`
- 결과: 통과

### 3.2 빌드
- `npm run build`
- 결과: 통과

### 3.3 E2E 스모크
- `DRAW_FIXTURE_COUNT=17`
- `npx playwright test e2e/live-draw-verify.spec.ts --project=chromium`
- 결과: 통과
- 리포트:
  - `artifacts/live-draw/20260217_154259/report.json`
  - `mobileFullSlotVisible: true`
  - `mobileFocusCandidateVisible: true`
  - `mobileCurrentLineReadable: true`

## 4. 결론
- Phase 3 완료:
  - 전광판 UI가 관리자/시청자 화면과 일관되게 결합되었고,
  - 모바일에서 후보 전원 존재 + 현재 후보 식별성이 확인되었으며,
  - 저사양 모드에서도 동일 플로우로 동작함을 확인했다.
