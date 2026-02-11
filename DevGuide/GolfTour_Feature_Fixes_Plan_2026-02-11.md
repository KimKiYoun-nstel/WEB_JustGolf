# GolfTour 기능 개선 계획 (2026-02-11)

## 목적

- 게시판, 경품 지원, 참가자 활동 선택, 대회 목록 표시를 현재 코드/DB 구조에 맞게 정상 동작하도록 개선한다.
- Supabase 분리 이후에도 기존 기능 흐름이 동일하게 동작하도록 보완한다.

## 현황 요약

- 게시판/경품 목록 조회는 `profiles` 조인으로 인해 레코드가 숨겨질 수 있음.
- 참가자 목록에는 활동 선택(최대 3개)이 출력되지 않음.
- 대회 목록 페이지의 정보 표시가 단순하며, 신청자 수/메모 등 핵심 정보가 빠져 있음.

## 작업 범위

1) 게시판 피드백 목록 표시 개선
2) 경품 지원 현황 표시 개선
3) 참가자 목록에 활동 선택(최대 3개) 표시
4) 대회 목록 카드 정보 확장 및 신청자 수 표시

## 상세 계획

### 1) 게시판 목록 표시

- 문제: `feedbacks` 조회 시 `profiles` 조인이 내부 조인으로 처리되어 프로필이 없는 계정의 글이 제외될 수 있음.
- 조치:
  - `profiles` 조인을 `left join` 방식으로 변경.
  - 닉네임이 없을 경우 "익명"으로 표시.
- 변경 대상:
  - `app/board/page.tsx`

### 2) 경품 지원 현황 표시

- 문제: `tournament_prize_supports` 조회 시 `profiles` 조인으로 인해 일부 레코드가 누락될 수 있음.
- 조치:
  - `profiles` 조인을 `left join` 방식으로 변경.
  - 닉네임이 없으면 "익명" 표시.
- 변경 대상:
  - `app/t/[id]/page.tsx`
  - `app/t/[id]/participants/page.tsx`

### 3) 참가자 목록에 활동 선택 표시

- 문제: 참가자 목록에 `registration_activity_selections`가 조회되지 않음.
- 조치:
  - `registrations` 조회 시 `registration_activity_selections` 및 `tournament_extras`를 함께 가져옴.
  - 선택된 활동명 최대 3개를 표시하고, 없는 경우 "-" 처리.
- 변경 대상:
  - `app/t/[id]/participants/page.tsx`

### 4) 대회 목록 정보 확장

- 문제: 대회 카드 정보가 축약되어 의미가 불명확하고 신청자 수가 표시되지 않음.
- 조치:
  - 조회 필드에 `notes`, `tee_time` 등 추가.
  - `registrations`를 조회해 대회별 신청자 수(예: `status != canceled`) 집계.
  - 카드 내에 필드 라벨을 명확히 표시.
- 변경 대상:
  - `app/tournaments/page.tsx`

## 데이터/권한 고려

- `profiles` 조인으로 인한 누락을 방지하기 위해 `left join` 사용.
- RLS 정책은 기존 정책을 유지하며, 조회 로직만 보완.

## 테스트/검증

- 게시판: 피드백 작성 후 목록 즉시 표시 확인.
- 경품 지원: 지원 등록 후 상세/참가자 페이지에 표시 확인.
- 참가자 활동: 활동 선택(1~3개) 저장 후 참가자 목록에 표시 확인.
- 대회 목록: 각 카드에서 필드 라벨/신청자 수 표시 확인.

## 예상 변경 파일

- `app/board/page.tsx`
- `app/t/[id]/page.tsx`
- `app/t/[id]/participants/page.tsx`
- `app/tournaments/page.tsx`

## 진행 순서

1) 게시판/경품 목록 조인 방식 수정
2) 참가자 활동 표시 추가
3) 대회 목록 정보 확장 및 신청자 수 집계
4) 로컬 확인 후 통합 점검
