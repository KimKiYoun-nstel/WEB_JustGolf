# 사전/사후 라운드 신청 상태 워크플로우 보완 분석 및 계획 (2026-03-10)

## 1) 요청사항
- 관리자(전역 + 대회별 권한자)가 사전/사후 라운드 신청자 상태를 변경할 수 있어야 함
  - 적용 상태: `applied`, `confirmed`, `waitlisted`, `canceled`
- 관리자 라운드 관리 페이지 상단에 상태별 요약을 표시
- 일반 사용자는 `applied` 상태에서만 취소 가능
- 취소 이력은 삭제/복구 덮어쓰기 없이 유지
- 마감 라운드(`status != open` 또는 시간창 종료)는 신규 신청 차단

## 2) 영향 범위
- 프론트엔드
  - `app/admin/tournaments/[id]/side-events/page.tsx`
  - `app/t/[id]/page.tsx`
- DB/RLS
  - `side_event_registrations` 사용자 insert/update/delete 정책
  - 신규 마이그레이션: `db/migrations/038_side_event_user_status_guardrails.sql`

## 3) 권한/RLS 설계
- 관리자 상태 변경
  - 기존 `can_manage_tournament` 기반 scoped admin update 정책 재사용
- 일반 사용자 insert
  - `side_events.status='open'` + `open_at/close_at` 시간창 내에서만 허용
- 일반 사용자 update
  - old row가 `applied`인 경우만 허용
  - new row는 `applied` 또는 `canceled`만 허용
- 일반 사용자 delete
  - 차단(이력 보존)

## 4) UI/동작 설계
- 관리자 라운드 관리
  - 신청자 목록(모바일/데스크탑)에 상태 변경 select 추가
  - 상단 요약 카드에 상태별 집계(전체/사전/사후) 추가
- 사용자 라운드 신청
  - 라운드 open/시간창 검사 후 신청 버튼 활성
  - 취소는 현재 상태가 `applied`일 때만 허용
  - 기존 취소 이력이 있어도 재신청 시 새 row insert

## 5) 검증 계획
1. 권한자 계정으로 라운드 신청 상태 변경 및 즉시 반영 확인
2. 상태 요약 카드 수치가 신청 목록과 일치하는지 확인
3. 일반 사용자에서 `confirmed/waitlisted/canceled` 상태 취소 시 차단 확인
4. 마감 라운드에서 신청 버튼 비활성/차단 메시지 확인
5. 취소 후 재신청 시 canceled row 유지 + 신규 applied row 생성 확인