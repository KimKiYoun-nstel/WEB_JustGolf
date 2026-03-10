# 대회별 임시 관리자 권한 확장 분석 및 구현 계획 (2026-03-10)

## 1) 요구사항 요약
- 일반 사용자에게 대회별 임시 권한을 부여하면 해당 대회에 한해 관리자와 동일한 관리 권한을 제공한다.
- `/admin/tournaments/[id]/*` 관리 화면 전반에 접근 가능해야 한다.
- 네비게이션 UI에서 권한 보유자가 담당 대회 관리 화면으로 진입할 수 있어야 한다.
- 전역 관리자 전용 기능(예: 회원 관리자, 새 대회 생성)은 기존 `is_admin` 기준을 유지한다.

## 2) 현재 구조 분석
- `app/admin/layout.tsx`가 `/admin` 전체에 대해 `profiles.is_admin`만 허용하고 있어 scoped 권한 사용자가 진입 불가.
- `app/admin/tournaments/[id]/layout.tsx`도 별도로 `is_admin` 체크를 수행해 2중 차단.
- 일부 페이지(`side-events`)는 `manager_permissions`를 확인하지만 상위 레이아웃에서 이미 차단됨.
- `manager_permissions` RLS가 관리자 전용(`FOR ALL`)이라 일반 사용자가 본인 권한 행도 조회 불가.
- 대회 관리 테이블 RLS가 대부분 전역 관리자 기준이라 scoped 권한으로 write가 어려움.
- API(`/api/admin/tournaments/[id]/draw`, `/registrations/export`)도 `requireAdmin: true`로 제한됨.

## 3) 핵심 설계
### 3-1. 권한 모델
- `manager_permissions.can_manage_tournament`(boolean) 추가.
- 기존 `can_manage_side_events=true` 데이터는 `can_manage_tournament=true`로 백필.
- 함수 `public.can_manage_tournament(uid, tournament_id)` 도입:
  - 전역 관리자면 true
  - 활성(`revoked_at is null`)된 대회별 임시 관리자면 true

### 3-2. 접근 제어
- 클라이언트 공용 헬퍼 `lib/tournamentAdminAccess.ts` 추가:
  - 현재 사용자 전역 관리자 여부
  - 특정 대회 scoped 관리자 여부
  - 담당 대회 존재 여부 조회
- `/admin` 루트 레이아웃:
  - `/admin/tournaments`: 전역 관리자 또는 담당 대회 1개 이상이면 허용
  - `/admin/tournaments/[id]/*`: 해당 대회 scoped 권한이면 허용
  - 그 외 `/admin/*`: 전역 관리자만 허용
- `/admin/tournaments/[id]/*` 개별 페이지의 로컬 `is_admin` 검사 제거/대체.

### 3-3. DB/RLS 확장
- `manager_permissions`에 본인 조회 + scoped 권한자가 동일 대회 권한 부여/회수 가능 정책 추가.
- 대회 관리 관련 테이블에 scoped admin 정책 추가:
  - `tournaments`, `registrations`, `side_events`, `side_event_registrations`
  - `tournament_meal_options`, `tournament_files`, `tournament_extras`
  - `tournament_groups`, `tournament_group_members`
- 기존 전역 관리자 정책은 유지(OR 허용).

### 3-4. API 확장
- `lib/apiGuard.ts`에 `requireTournamentAdminFor` 옵션 추가.
- draw/export API는 전역 관리자 대신 `requireTournamentAdminFor: tournamentId`로 권한 판별.

## 4) 구현 단계
1. 권한 헬퍼/가드 확장
   - `lib/tournamentAdminAccess.ts`
   - `lib/apiGuard.ts`
2. 라우트 권한 변경
   - `app/api/admin/tournaments/[id]/draw/route.ts`
   - `app/api/admin/tournaments/[id]/registrations/export/route.ts`
3. 관리자 레이아웃 변경
   - `app/admin/layout.tsx`
   - `app/admin/tournaments/[id]/layout.tsx`
4. 페이지별 권한 체크 교체
   - `edit/extras/files/groups/manager-setup/meal-options/registrations/side-events`
5. 네비게이션 UI 보강
   - `app/start/page.tsx` 담당 대회 바로가기 추가
   - `app/admin/tournaments/page.tsx` scoped 사용자용 “담당 대회” 목록/동작 지원
6. DB 마이그레이션 작성
   - `db/migrations/037_tournament_scoped_admin_permissions.sql`

## 5) RLS/권한 영향 검토
- 관리자/임시관리자/일반회원 3개 역할의 접근 경계를 명확히 분리.
- 비로그인 사용자는 기존과 동일하게 관리자 경로 접근 불가.
- scoped 권한은 `tournament_id`를 키로 제한되어 타 대회 영향 없음.
- 전역 관리자 권한 축소 없음(기존 정책 유지).

## 6) 위험요소 및 대응
- 위험: 환경 DB에 새 컬럼 미반영 상태에서 런타임 쿼리 실패 가능.
  - 대응: 배포 전 `037` 마이그레이션 수동 실행 필수.
- 위험: 일부 페이지에 남아있는 하드코딩 권한 문구/체크 누락.
  - 대응: `is_admin` 검색 및 수동 플로우 점검으로 누락 제거.
- 위험: 기존 정책과 신규 정책 충돌 가능성.
  - 대응: 신규 정책은 별도 이름으로 추가하고 조건을 대회 ID로 최소화.

## 7) 검증 계획
- 정적 검증: `npm run lint`
- 빌드 게이트: `npm run build`
- 수동 시나리오
  1. 전역 관리자: 기존 모든 `/admin` 기능 정상 접근/수정 가능
  2. 대회 임시 관리자(권한 부여된 대회): `/admin/tournaments` 및 해당 대회 상세 관리 화면 접근/수정 가능
  3. 대회 임시 관리자(권한 없는 다른 대회): 해당 대회 상세 페이지 접근 차단
  4. 일반 회원: `/admin` 진입 차단
  5. 임시 관리자 권한 회수 후: 즉시 접근 차단

## 8) 누락 0 체크리스트
- [x] 클라이언트 라우팅 접근 제어 반영
- [x] 서버 API 권한 판별 반영
- [x] DB 컬럼/함수/RLS 설계 반영
- [x] 네비게이션 UI 진입 경로 반영
- [x] 문서화(분석/계획) 반영
