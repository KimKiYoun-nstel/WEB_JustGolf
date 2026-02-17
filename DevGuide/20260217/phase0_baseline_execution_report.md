# Phase 0 실행 리포트 (가변 인원 기준)

## 1. 목적
- 기준선(Baseline) 확보:
  - 현재 라이브 추첨 플로우의 관리자/시청자 UI 동작 캡처
  - 고정 40명이 아닌 `N명(가변)` 조건에서 동작 확인
- 대상:
  - 관리자 화면: `/admin/tournaments/[id]/draw`
  - 시청자 화면(데스크톱/모바일): `/t/[id]/draw`

## 2. 이번 Phase 0에서 반영한 내용
- 계획 문서 업데이트:
  - `DevGuide/20260217/method1_scoreboard_draw_development_plan.md`
  - 40명 고정 표현을 `N명(가변)` 기준으로 수정
  - 모바일 표현 원칙(Active/Near-Miss/Background) 유지
- E2E 기준선 테스트 보강:
  - `e2e/live-draw-verify.spec.ts`
  - `DRAW_FIXTURE_COUNT` 환경변수로 가변 인원 fixture 생성
  - 관리자 + 시청자(데스크톱) + 시청자(모바일) 스냅샷 동시 저장
  - 모바일 컨텍스트 인증 공유(storage state) 적용

## 3. 실행한 검증 명령
```powershell
npm run test -- lib/draw/reducer.test.ts

$env:DRAW_FIXTURE_COUNT='17'; npx playwright test e2e/live-draw-verify.spec.ts --project=chromium
$env:DRAW_FIXTURE_COUNT='40'; npx playwright test e2e/live-draw-verify.spec.ts --project=chromium
$env:DRAW_FIXTURE_COUNT='57'; npx playwright test e2e/live-draw-verify.spec.ts --project=chromium
```

## 4. 결과 요약
- 단위 테스트: 통과 (`lib/draw/reducer.test.ts`, 8/8)
- E2E(가변 인원): 17/40/57 모두 통과

| participantCount | tournamentId | report |
|---|---:|---|
| 17 | 21 | `artifacts/live-draw/20260217_142443/report.json` |
| 40 | 22 | `artifacts/live-draw/20260217_142702/report.json` |
| 57 | 23 | `artifacts/live-draw/20260217_142943/report.json` |

공통 체크 통과:
- `canvasVisible=true`
- `viewerCanvasVisible=true`
- `mobileViewerCanvasVisible=true`
- `winnerTextStable=true`
- `noSpinTextAfterConfirm=true`
- `noConsoleErrors=true`

## 5. 산출물
- 테스트 리포트/캡처:
  - `artifacts/live-draw/20260217_142443/*`
  - `artifacts/live-draw/20260217_142702/*`
  - `artifacts/live-draw/20260217_142943/*`
- 주요 캡처 유형:
  - 관리자 전체/애니메이터 스테이지
  - 시청자 데스크톱 전체
  - 시청자 모바일 전체

## 6. Phase 0 결론
- 라이브 추첨 현재 템플릿은 `N명(가변)` 조건에서 정상 동작한다.
- 관리자/시청자(데스크톱/모바일) baseline 캡처가 확보되었다.
- 방식1(전광판 하이라이트) 구현을 Phase 1부터 착수 가능한 상태다.
