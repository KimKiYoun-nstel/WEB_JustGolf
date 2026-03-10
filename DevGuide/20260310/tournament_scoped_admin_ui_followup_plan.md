# 대회별 관리자 권한 UI 보완 분석 및 구현 계획 (2026-03-10)

## 1) 배경
- 대회별 임시 관리자 권한(`can_manage_tournament`)은 동작하지만, 진입 UI가 `/start`에 집중되어 있어 실사용 동선이 불편함.
- 사용자 관점에서 대회 목록에서 바로 관리로 이동하고, 사전/사후 라운드 현황을 빠르게 파악할 수 있어야 함.

## 2) 요구사항 정리
1. 대회 목록 카드에서 권한자에게 `관리 페이지` 이동 UI 제공
2. 대회 목록 요약에 사전/사후 라운드 정보(제목, 신청자 수) 노출
3. 관리자 사전/사후 라운드 관리 페이지 상단에 요약 카드 추가

## 3) 영향 범위
- 프론트엔드
  - `app/tournaments/page.tsx`
  - `app/admin/tournaments/[id]/side-events/page.tsx`
- 데이터 조회
  - `tournaments`
  - `manager_permissions`
  - `side_events`
  - `side_event_registrations`
- DB 스키마/RLS 변경 없음

## 4) 권한/보안 검토
- 관리 페이지 버튼 노출 조건
  - 전역 관리자(`profiles.is_admin = true`) 또는
  - 대회별 관리자(`manager_permissions.can_manage_tournament = true`, `revoked_at is null`)
- 버튼은 UI 편의 기능이며, 실제 접근 제어는 기존 `/admin` 레이아웃 + RLS + API 가드가 담당
- 비권한 사용자는 버튼이 노출되지 않으며, 직접 URL 접근 시에도 서버/DB 권한 체계로 차단

## 5) 구현 계획
1. `app/tournaments/page.tsx`
- 권한 조회: `getTournamentAdminAccess`, `listManagedTournamentIds`
- 카드 하단 CTA를 세로 배치
  - `상세 보기`
  - (권한자만) `관리 페이지`
- `side_events` + `side_event_registrations` 기반 요약 렌더링
  - `[사전|사후] 제목 · 신청 N명`

2. `app/admin/tournaments/[id]/side-events/page.tsx`
- 기존 라운드/신청 데이터로 상단 요약 카드 구성
  - 전체 라운드 수
  - 사전/사후 라운드 수
  - 사전/사후 신청자 수
  - 총 신청자 수
  - 신청 상위 라운드 3개

3. 검증
- `npm run build`
- 수동 시나리오
  - 일반 사용자: 관리 페이지 버튼 비노출
  - 대회별 관리자: 권한 대회에서만 버튼 노출 및 진입 가능
  - 전역 관리자: 전체 대회에서 버튼 노출
  - 라운드 요약 수치/라벨 표시 확인

## 6) 리스크 및 대응
- 리스크: 라운드/신청 데이터가 많을 때 목록 페이지 조회량 증가
- 대응:
  - 대회 목록 범위 내(`tournamentIds`)로 조회 제한
  - 신청 집계는 클라이언트에서 단순 카운팅
  - 필요 시 추후 RPC 집계 함수로 대체 가능

## 7) 완료 기준
- 대회 목록에서 권한자 관리 이동 가능
- 대회 목록에서 사전/사후 요약 확인 가능
- 라운드 관리 페이지 상단 요약 카드 표시
- 빌드 성공