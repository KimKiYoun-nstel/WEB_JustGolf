# 방식1(전광판 하이라이트) 라이브 추첨 개발 계획

## 1. 문서 목적
- 대상: `DevGuide/20260217/a_type_draw_animation_design.md`의 **방식1(전광판 하이라이트)** 구현
- 목표: 기존 라이브 추첨 템플릿(세션/이벤트/조배정)은 유지하고, 애니메이션 레이어를 방식1로 교체/고도화
- 범위: 관리자 화면(`/admin/tournaments/[id]/draw`) + 시청자 화면(`/t/[id]/draw`) + 검증 자동화/수동 QA

## 진행 현황 (2026-02-17)
- Phase 0 완료: 기준선 캡처/기존 검증 통과
- Phase 1 완료: 애니메이터 인터페이스 확장 및 호스트 도입
- Phase 2 완료: 전광판 코어 모션(스캔/near-miss/수렴) 구현 및 scoreboard 연결
- Phase 3 완료: 모바일 가독성/패널 접기/저사양 분기/상태바 일관성 반영
- Phase 3.5 완료: 단일 방향 체이스 + 관리자 상호작용 픽 + 서버 권위 동기화 + Active/Winner 시각 강조 2차 강화

## 2. 현재 상태 요약 (2026-02-17 기준)
- 현재 추첨 UI는 `LottoAnimator` 기반이며, 실사용은 로또 스타일이 고정되어 있음.
- 이벤트 흐름은 이미 안정적으로 동작:
  - `STEP_CONFIGURED` -> `PICK_RESULT` -> `ASSIGN_CONFIRMED`
- 리플레이/실시간 동기화 구조는 이미 구현됨:
  - draw 이벤트 스트림 구독 + reducer 재구성
- 결론: **비즈니스 로직을 대폭 바꾸지 않고 애니메이터 모듈 교체 중심으로 진행 가능**

## 3. 최종 구현 목표 (방식1)
### 3.1 기능 목표
- 후보 전체의 "존재"를 항상 화면에서 확인 가능하게 노출(완전 블라인드 추첨 금지)
- 스캔 하이라이트가 가속/감속/near-miss를 거쳐 최종 후보에 수렴
- 관리자/시청자 화면이 같은 이벤트를 받아 동일한 상태와 타이밍으로 보이도록 유지
- 당첨 확정 전에는 결과를 직접 텍스트로 노출하지 않고, `PICK_RESULT` 수신 시점부터만 수렴 표시

### 3.2 최종 UI 완성도 기준 (명시적 합격선)
- A. 정보 구조 완성도
  - 상단 상태바: 현재 step, 타겟 조, LIVE 상태, 남은 인원 명확 표기
  - 중앙: `N명(가변)` 후보 그리드가 화면에서 인지 가능(PC), 모바일은 "핵심 후보 강조 + 비핵심 배경화" 재배치
  - 하단 자막바: 현재 후보/남은 후보 수/타겟 조를 일관된 위치에 표시
- B. 모션 완성도
  - 하이라이트 3요소(색 변화 + 글로우 + 스케일)가 동시에 동작
  - 마지막 15~20% 구간에서 near-miss 후 winner 수렴이 시각적으로 납득 가능
  - 프레임 드랍 시에도 핵심 상태(현재 후보, 당첨자, 조 배정)는 잃지 않음
- C. 운영 완성도
  - 관리자 조작(`start_step`, `pick_result`, `assign_confirm`) 시 UI 피드백 즉시 반영
  - 새로고침/중간합류 시 이벤트 리플레이로 현재 스텝/상태가 복원
  - 저사양 모드에서 최소 효과로 동일 플로우 유지
- D. 품질 완성도
  - 단위 테스트 + E2E 스모크 + 수동 QA 체크리스트 통과
  - 문서 요구사항 대비 구현 여부를 체크리스트로 검증(누락 0)

### 3.3 모바일 표현 원칙 (이번 계획의 핵심)
- 전원 "존재"는 유지:
  - 모바일에서도 후보 전원 슬롯(미니 카드/점/번호)을 계속 노출해 "누가 풀에 있는지"는 항상 확인 가능하게 유지
- 시선 집중은 계층화:
  - `Active`(현재 커서/직전/다음): 강한 강조(밝기/글로우/스케일)
  - `Near-Miss`(근접 후보군): 중간 강조
  - `Background`(나머지): 저채도/저명도/작은 모션으로 배경화
- 이름 가독성은 자막/확대 카드에서 보장:
  - 하단 자막에 `번호 + 닉네임`을 크게 표기
  - 그리드 내 배경 후보는 간결 표기(번호 중심)
- 정리:
  - "전원을 같은 강도로 다 보여준다"가 아니라, "전원 존재를 유지하면서 현재 가능성 후보를 명확히 보여준다"를 목표로 한다.

## 4. 요구사항 매핑 (방식1 기준)
| 요구사항 | 구현 항목 | 검증 방법 |
|---|---|---|
| 후보 전체 상시 노출 | `CandidateGrid` 전원 슬롯 유지 + Active/Near-Miss/Background 계층 표현 | 화면 캡처 비교(초기/진행/확정, 모바일 포함) |
| 기대감 연출(가속/감속/근접) | seed 기반 path + easing + near-miss | 애니메이션 로그 + 육안 QA |
| 결과 숨김/수렴 | `PICK_RESULT` 수신 전 winner 텍스트 비노출 | E2E assertion |
| 전 클라이언트 동기화 | 기존 realtime + replay 유지, seed 동일 입력 사용 | 관리자/시청자 동시 관찰 |
| 확정 후 조 배정 반영 | `ASSIGN_CONFIRMED` 시 그룹 카드/현황 동기 업데이트 | 기존 회귀 테스트 |

## 5. 아키텍처/코드 변경 계획
## 5.1 유지
- API 이벤트 체계 및 reducer 기반 상태 재구성
- 관리자 패널의 스텝 진행/확정 플로우

## 5.2 변경
- `components/draw/LottoAnimator.tsx` 중심 구조를 **Animator Host**로 정리
- 신규 방식1 컴포넌트 추가:
  - `components/draw/scoreboard/ScoreboardAnimator.tsx`
  - `components/draw/scoreboard/CandidateGrid.tsx`
  - `components/draw/scoreboard/CandidateCard.tsx`
  - `components/draw/scoreboard/LowerThird.tsx`
  - `lib/draw/animators/scoreboard/path.ts` (seed/path/near-miss)
- 타입 확장(하위 호환):
  - `STEP_CONFIGURED` payload optional 필드: `seed`, `pattern`, `tempo`
  - 기존 payload 소비 코드와 충돌 없이 optional 처리

## 6. 단계별 개발 계획
## Phase 0. 기준선 고정
- 작업
  - 현재 draw 플로우를 기준선으로 캡처(관리자/시청자)
  - 기존 테스트 상태 통과 확인
- 완료 기준
  - 기준선 스냅샷/로그 확보
  - `lib/draw/reducer.test.ts` 통과

## Phase 1. 애니메이터 인터페이스 정리
- 작업
  - 기존 `AnimatorProps`를 방식1/방식2 확장 가능한 형태로 정리
  - 후보 데이터 입력 구조를 방식1 렌더링에 맞게 정리(번호/라벨/시각 상태 분리)
- 완료 기준
  - 기존 화면 렌더 회귀 없음
  - 타입/빌드/기존 테스트 통과

## Phase 2. 방식1 코어 모션 구현
- 작업
  - seed 기반 path 생성 로직 구현(PRNG + 구간별 템포)
  - 하이라이트 커서 진행/잔상/near-miss/수렴 구현
  - `PICK_RESULT` 수신 시 final converge 처리
- 완료 기준
  - 동일 입력(seed+startedAt+durationMs)에서 재현 가능한 경로 확인
  - near-miss 횟수/수렴 타이밍 설정값대로 동작

## Phase 3. UI 조립 및 상태 연결
- 작업
  - 관리자/시청자 페이지에서 방식1 애니메이터 연결
  - 하단 자막바, 진행 상태바, 그룹 현황과의 시각적 일관성 조정
  - 모바일 전용 표현 반영:
    - Active/Near-Miss/Background 강도 차등
    - 전원 슬롯 상시 표시 유지
    - 조 편성/남은 목록은 접기 또는 하단 배치로 애니메이션 가독성 우선
  - 저사양 모드 분기(효과 축소)
- 완료 기준
  - PC/모바일 레이아웃 무너짐 없음
  - 모바일에서 "현재 후보가 누구인지" 1초 내 식별 가능
  - 모바일에서 후보 전원 슬롯이 지속적으로 확인 가능
  - 관리자/시청자 동시 화면에서 상태 불일치 없음

## Phase 3.5. 체이스 연출 고도화 + 상호작용 픽
- 작업
  - 랜덤 점프형 스캔 제거, 단일 방향 체이스 + 후반 감속으로 모션 규칙 고정
  - 관리자 수동 클릭 시점 커서(`cursorIndex`) 선택, 무클릭 시 종료 시점 자동 픽으로 플로우 확장
  - 서버에서 최종 선택을 권위적으로 계산/확정하여 시청자 전원 동일 결과 보장
  - Active/Winner/Background 대비를 명확히 보이도록 카드/상태칩/하단 자막의 색상/강조 강도 상향
- 완료 기준
  - 랜덤 점프 없이 한 방향 이동과 감속이 눈으로 식별 가능
  - 수동 픽/자동 픽 모두 동일 결과 동기화 규칙으로 재현 가능
  - 현재 후보/당첨 후보가 모바일에서도 즉시 구분 가능
  - 단위 테스트 + 빌드 + live-draw E2E 통과

## Phase 4. 자동 테스트 확장
- 작업
  - 단위 테스트: path 생성/수렴/near-miss 로직
  - E2E 스모크: step 시작 -> pick -> confirm까지 핵심 assertion
  - 기존 `scripts/verify-live-draw-playwright.mjs`를 방식1 DOM/문구에 맞게 보정
- 완료 기준
  - 단위 테스트/스모크 테스트 녹색
  - 실패 시 캡처/리포트가 원인 파악 가능

## Phase 5. 실제 데이터 검증 (dev Supabase)
- 작업
  - seed 데이터 투입(기존 스크립트 재활용)
  - 실데이터로 `N명(가변)` 시나리오 점검
  - 검증 매트릭스 예시: 17명 / 40명 / 57명
  - 관리자/시청자 2브라우저 동시 검증
- 완료 기준
  - 요구사항 체크리스트 100% 충족
  - 성능/가독성/동기화 이슈 재현되지 않음

## 7. 자체 테스트 환경 구축/운영 계획
## 7.1 자동 테스트
- 단위 테스트
  - 명령: `npm run test -- lib/draw/reducer.test.ts`
  - 확장 대상: `lib/draw/animators/scoreboard/*.test.ts`
- E2E
  - 기본: `npm run test:e2e`
  - draw 스모크 스크립트: `node scripts/verify-live-draw-playwright.mjs`
  - 산출물: `artifacts/live-draw/<timestamp>/report.json` + 스크린샷

## 7.2 실데이터 시드/정리
- 투입
  - `npm run seed:draw -- seed --tournament <id> --count 40 --prefix draw-test --korean8`
- 정리
  - `npm run seed:draw -- cleanup --tournament <id> --prefix draw-test`
- 원칙
  - `relation='draw-seed'` + `memo` tag 기반으로만 정리
  - 기존 운영/테스트 데이터 비파괴

## 8. 요구사항 검증 체크리스트 (출시 전)
- [ ] 후보 전원 "존재" 상시 노출(PC/모바일)
- [ ] 모바일에서 Active/Near-Miss/Background 계층이 시각적으로 명확함
- [ ] 모바일에서 하단 자막 `번호 + 닉네임` 가독성 확보
- [ ] 하이라이트 가속/감속/near-miss 구현
- [ ] `PICK_RESULT` 전 winner 직접 노출 금지
- [ ] `ASSIGN_CONFIRMED` 후 조편성/남은 후보 즉시 반영
- [ ] 중간 합류 시 리플레이/동기화 정상
- [ ] 저사양 모드에서 기능 동일/효과 축소
- [ ] 단위 테스트/E2E/수동 QA 모두 통과
- [ ] 문서(`a_type_draw_animation_design.md`) 항목별 누락 없음

## 9. 리스크 및 대응
- 리스크: 모바일에서 정보 과밀로 현재 후보 식별 실패
  - 대응: Active/Near-Miss/Background 계층 강제, 하단 자막 우선 표시
- 리스크: 애니메이션 고도화로 프레임 저하
  - 대응: 저사양 모드 강제 단순화, 카드 효과 옵션화
- 리스크: 실시간 지연으로 체감 불일치
  - 대응: `startedAt + durationMs` 타임라인 기준 렌더, 지연 허용 보간

## 10. 진행 준비 상태 (업데이트)
- 준비 완료 항목
  - 방식1 기준 모바일 표현 정책 확정(전원 존재 유지 + 핵심 후보 강조)
  - 동명이인 대응 항목은 요구사항에서 제외
- 구현 착수 전 바로 할 일
  - Phase 0 기준선 캡처 시 모바일 캡처를 필수 항목으로 포함
  - Phase 3 완료 기준에 모바일 식별성 체크를 E2E assertion으로 추가

## 11. 오늘 점검 결과 (자체 테스트 가능 여부)
- 확인 완료
  - `.env.local`/`.env.production.local`에 Supabase 관련 키 정의 존재
  - service role로 Supabase read 연결 성공
  - draw reducer 단위 테스트 통과
  - Playwright 설치/실행 가능(버전 확인)
  - seed 스크립트 실행 가능(usage 정상)
- 결론
  - **현재 저장소는 방식1 개발을 위한 자체 테스트 환경을 이미 갖추고 있음**
  - 다음 단계는 Phase 0부터 실제 구현 착수 가능
