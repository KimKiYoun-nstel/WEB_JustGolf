---
name: ui-ux-implementation-loop
description: Implement WEB_JustGolf UI changes with consistent UX standards and a fast feedback loop. Use when building or refining web UI that must preserve existing business logic while improving usability across desktop and mobile.
---

# UI UX Implementation Loop

UI를 구현할 때 기준을 지키고, 사용자 피드백을 빠르게 반영한다.

## 핵심 출력물
- 변경된 UI 코드
- 수동 QA 체크리스트(3~5개)
- 피드백 반영 내역

## 워크플로
1. 기존 동작을 먼저 고정한다.
- 비즈니스 로직/권한 로직은 유지하고 UI 계층만 변경한다.
- 변경 전 화면과 핵심 동선을 기준선으로 기록한다.

2. UI 기준을 적용한다.
- 정보 계층(제목/본문/행동 버튼)을 명확히 분리한다.
- 모바일/데스크톱 모두에서 주요 액션이 첫 화면 내에서 인지되게 배치한다.
- 공통 컴포넌트(`components/ui`)를 우선 재사용한다.

3. 반응형/접근성을 확인한다.
- 모바일 폭(예: 390px)과 데스크톱 폭(예: 1366px)에서 모두 검증한다.
- `aria-label`, 포커스 이동, 키보드 접근을 점검한다.

4. 시각 검증 루프를 수행한다.
- 구현 직후 화면 캡처를 남긴다.
- 사용자 피드백 항목을 "문제-수정-검증" 3열로 관리한다.
- 수정 후 동일 시나리오를 다시 캡처해 비교한다.

5. 완료 조건을 확인한다.
- 기능 동작 유지
- 반응형 깨짐 없음
- 주요 UX 불만 항목 해소

## 레포 전용 규칙
- `DevGuide/ui_upgrade/*` 문서 방향성과 충돌하지 않게 구현한다.
- 관리자 화면은 좁은 뷰포트에서 여백/고정 요소 충돌을 우선 점검한다.
- 가능하면 Playwright 스모크 또는 스크린샷 기반 확인 절차를 같이 남긴다.

## 수동 QA 템플릿
- 시나리오 1: 핵심 페이지 진입 후 주요 CTA 인지 가능
- 시나리오 2: 모바일에서 메뉴/탭/시트 동작 정상
- 시나리오 3: 권한 없는 사용자 메시지/차단 UX 정상
- 시나리오 4: 에러/로딩 상태 시각 피드백 정상
- 시나리오 5: 회귀 여부(기존 핵심 플로우 1개)
