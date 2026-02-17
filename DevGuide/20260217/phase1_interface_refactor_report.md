# Phase 1 실행 리포트 (애니메이터 인터페이스 정리)

## 1. 목표
- 방식1(전광판) 도입 전, 기존 추첨 플로우를 깨지 않고 애니메이터 입력 구조를 확장한다.
- 핵심:
  - 후보 입력을 `label[]` 중심에서 `candidate{id,label,slotNo}` 중심으로 전환
  - 향후 애니메이터 교체를 위한 호스트 컴포넌트 도입

## 2. 적용 내용
- 공통 애니메이터 타입 확장:
  - `lib/draw/animators/Animator.ts`
  - 추가: `DrawAnimatorKind`, `AnimatorCandidate`, `currentPickCandidateId`, `candidates`
  - 기존 `candidateLabels`, `currentPickLabel`은 마이그레이션 기간 fallback으로 유지

- 애니메이터 호스트 추가:
  - `components/draw/DrawAnimator.tsx`
  - 현재 `kind="lotto"` 동작 유지, `kind="scoreboard"`는 Phase 2에서 실제 구현체로 교체 예정

- 기존 로또 애니메이터 입력 정리:
  - `components/draw/LottoAnimator.tsx`
  - `candidates`(id+label) 우선 사용
  - `currentPickCandidateId` 기반 winner 매칭 우선 사용
  - fallback으로 기존 `currentPickLabel` 매칭 유지

- 페이지 연결부 전환:
  - `app/admin/tournaments/[id]/draw/page.tsx`
  - `app/t/[id]/draw/page.tsx`
  - `LottoAnimator` 직접 호출 -> `DrawAnimator` 호출로 변경
  - `candidates` + `currentPickCandidateId` 전달

## 3. 검증 결과
- 빌드: 통과
  - `npm run build`
- 단위 테스트: 통과
  - `npm run test -- lib/draw/reducer.test.ts`
- E2E 스모크(가변 인원): 통과
  - `DRAW_FIXTURE_COUNT=17` + `npx playwright test e2e/live-draw-verify.spec.ts --project=chromium`

## 4. 결론
- Phase 1 목표 달성:
  - 기존 기능 회귀 없이 애니메이터 인터페이스를 방식1 도입 가능한 형태로 정리 완료
- 다음 단계:
  - Phase 2에서 `ScoreboardAnimator`(전광판 하이라이트) 실제 구현 착수
