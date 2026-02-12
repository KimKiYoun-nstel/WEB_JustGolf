# Golf Tour 프로젝트 종합 감사 리포트 (2026-02-11)

기준일: 2026-02-11 (수)
작성 목적: 기능/구조/DB/UI/API 현황과 리스크를 다음 작업 시 빠르게 재개하기 위한 기준 문서

---

## 1) 요약

현재 프로젝트는 Next.js(App Router) + Supabase(RLS) 기반으로 대회 운영 기능이 폭넓게 구현되어 있습니다.
다만 보안 경계(RLS 정책), DB 스키마 일관성, 테스트 분리, 일부 런타임 버그, N+1 쿼리 패턴이 주요 리스크입니다.

핵심 우선순위:
1. `profiles` RLS 정책 보완 (권한 상승 가능성 차단)
2. `side-events` 식사 옵션 테이블명 불일치 수정
3. Vitest/Playwright 테스트 파이프라인 분리
4. N+1 쿼리 정리
5. 마이그레이션/스키마 단일 소스 정리

---

## 2) 기술 구조

- 프레임워크: Next.js 16.1.6 (App Router)
- 인증/DB/스토리지: Supabase
- UI: Tailwind + shadcn/ui
- 테스트: Vitest + Playwright

주요 디렉터리:
- `app`: 페이지/라우트/서버 API
- `components`: UI 공용 컴포넌트
- `lib`: Supabase 클라이언트/서비스/유틸
- `db/migrations`: 로컬 마이그레이션 SQL
- `supabase/migrations`: 원격 스키마 덤프 계열
- `Docs`, `DevGuide`: 설계/운영 문서
- `__tests__`, `e2e`: 단위/통합, E2E 테스트

---

## 3) 기능 현황 (코드 기준)

### 사용자 기능
- 로그인/회원가입: `app/login/page.tsx`
- 시작 허브: `app/start/page.tsx`
- 대회 목록/상세/상태/참가자/조편성 조회:
  - `app/tournaments/page.tsx`
  - `app/t/[id]/page.tsx`
  - `app/t/[id]/status/page.tsx`
  - `app/t/[id]/participants/page.tsx`
  - `app/t/[id]/groups/page.tsx`
- 프로필: `app/profile/page.tsx`
- 게시판: `app/board/page.tsx`

### 관리자 기능
- 관리자 진입/레이아웃/사용자 관리:
  - `app/admin/page.tsx`
  - `app/admin/layout.tsx`
  - `app/admin/users/page.tsx`
- 대회 운영 전반:
  - `app/admin/tournaments/page.tsx`
  - `app/admin/tournaments/new/page.tsx`
  - `app/admin/tournaments/[id]/dashboard/page.tsx`
  - `app/admin/tournaments/[id]/edit/page.tsx`
  - `app/admin/tournaments/[id]/registrations/page.tsx`
  - `app/admin/tournaments/[id]/groups/page.tsx`
  - `app/admin/tournaments/[id]/side-events/page.tsx`
  - `app/admin/tournaments/[id]/meal-options/page.tsx`
  - `app/admin/tournaments/[id]/extras/page.tsx`
  - `app/admin/tournaments/[id]/files/page.tsx`
  - `app/admin/tournaments/[id]/manager-setup/page.tsx`

### 서버 API (관리자 사용자 관리)
- `app/api/admin/users/route.ts`
- `app/api/admin/users/[id]/approve/route.ts`
- `app/api/admin/users/[id]/set-admin/route.ts`

주의: 관리자 UI 일부는 위 API를 통하지 않고 클라이언트에서 Supabase 직접 갱신을 수행함.

---

## 4) 인증/접근 제어 동작

- 미들웨어에서 사실상 로그인 강제:
  - `middleware.ts:8` (`/login` 예외)
  - `middleware.ts:18` (비로그인 시 `/login` 리다이렉트)
- 루트(`/`)도 로그인으로 이동:
  - `app/page.tsx:11` (`router.replace("/login")`)

문서 대비 불일치:
- 문서 일부는 "공개 조회" 모델을 설명하지만, 현재 코드 동작은 로그인 필수 모델에 가깝습니다.

---

## 5) DB/마이그레이션 상태

### 확인된 문제
1. 마이그레이션 번호 중복
- `db/migrations/009_*.sql` 2개
- `db/migrations/012_*.sql` 2개
- `db/migrations/013_*.sql` 2개

2. 스키마 소스 불일치 가능성
- 코드에서 `app_settings` 사용:
  - `app/login/page.tsx:50`
  - `app/admin/users/page.tsx:65`
  - `app/admin/users/page.tsx:150`
- 생성 마이그레이션 존재:
  - `db/migrations/023_approval_toggle_settings.sql:4`
- 그러나 스냅샷 계열(`db/supabase_shcema.sql`, `supabase/migrations/20260211040209_remote_schema.sql`)에서 `app_settings` 확인 불가.

3. 원격 스키마 덤프에 광범위한 `GRANT ALL` 존재
- 예: `supabase/migrations/20260211040209_remote_schema.sql:2003` (`profiles` to `anon`)
- RLS가 활성화되어 있어도, 정책 결함 시 영향이 커질 수 있으므로 주의.

---

## 6) 주요 리스크 상세

### [Critical] 권한 상승 가능성 (RLS)
근거:
- `supabase/migrations/20260211040209_remote_schema.sql:1613`
  - `profiles_update_own` 정책은 본인 row update 허용(컬럼 제한 없음)
- `supabase/migrations/20260211040209_remote_schema.sql:182`
  - `is_admin(uid)`가 `profiles.is_admin` 값을 신뢰

영향:
- 일반 사용자가 자신의 `is_admin`/`is_approved`를 변경할 수 있으면 관리자 권한 정책 우회 가능성이 생김.

권고:
- `profiles_update_own`를 닉네임/표시용 컬럼만 허용하도록 분리
- `is_admin`, `is_approved`, 권한 관련 컬럼은 관리자 전용 정책/함수로만 수정 가능하게 제한

### [High] 부대행사 식사 옵션 로딩 버그
근거:
- `app/admin/tournaments/[id]/side-events/page.tsx:143`에서 `.from("meal_options")`
- 실제 테이블은 `tournament_meal_options` (`db/supabase_shcema.sql:186`)

영향:
- 관리자 부대행사 화면에서 식사 옵션 조회 실패 가능

권고:
- 테이블명 즉시 수정 + 화면 smoke test

### [High] 관리자 경로 아키텍처 이원화
근거:
- API는 존재하나(`app/api/admin/users/*`) 실제 UI는 direct query/update 사용
  - `app/admin/users/page.tsx:112`, `app/admin/users/page.tsx:129`, `app/admin/users/page.tsx:149`

영향:
- 보안 규칙과 감사 포인트가 분산되어 유지보수/감사 난이도 상승

권고:
- 관리자 변경 작업은 서버 API/서버 액션으로 단일화

### [Medium] N+1 쿼리 패턴
근거:
- `app/t/[id]/page.tsx:308`
- `app/t/[id]/participants/page.tsx:161`
- `app/t/[id]/status/page.tsx:171`
- `app/admin/tournaments/[id]/manager-setup/page.tsx:128`

영향:
- 데이터 증가 시 응답 지연

권고:
- batch 조회, join/select 확장, RPC로 묶기

### [Medium] 테스트 구성 충돌
근거:
- `vitest.config.ts`에 `e2e/**` 제외 없음
- `npm run test -- --run` 시 Playwright 스펙이 Vitest에서 실행되어 실패

영향:
- CI 신뢰도 저하, 회귀 탐지 품질 저하

권고:
- Vitest include/exclude 분리 (`e2e/**` 제외)
- `test`, `test:e2e` 파이프라인 완전 분리

### [Medium] 린트 에러 누적
근거:
- `npm run lint` 결과: 150 issues (86 errors, 64 warnings)

대표 유형:
- `react-hooks/set-state-in-effect`
- `no-explicit-any`
- `react/no-unescaped-entities`
- 선언 전 참조/훅 의존성

영향:
- 리팩터링/기능 추가 시 회귀 위험 증가

권고:
- 품질 기준선 재설정 후 단계적 감축

---

## 7) 성능 관점 리뷰

- 대형 페이지에 데이터 로딩/변환/액션이 집중
  - `app/t/[id]/page.tsx` (약 1700 lines)
- 권한 체크 쿼리가 페이지별 중복 수행
- 루프 내부 쿼리 다수

권고:
1. 데이터 접근 계층(service/RPC)로 이관
2. 권한 판정 공통화(미들웨어 + 서버 검증)
3. 대형 페이지 기능 분할(조회/액션 훅 분리)

---

## 8) UI/문자열 상태

- UI 구성은 일관된 컴포넌트 체계를 사용하고 있으나,
- 일부 테스트는 텍스트 매칭이 취약하고(`__tests__/components/Header.test.tsx`, `app/__tests__/routes.integration.test.tsx`),
- 문서/파일 일부에서 인코딩 혼선 흔적이 보임.

권고:
- 테스트는 role/label 기반으로 전환
- 문서/소스 인코딩 정책(UTF-8) 고정

---

## 9) 실제 실행 결과 기록

### 빌드
- `npm run build`: 성공
- 참고 경고: middleware convention deprecation (proxy 권고)

### 린트
- `npm run lint`: 실패
- 150 문제 (86 errors / 64 warnings)

### 테스트
- `npm run test -- --run`: 실패
- 핵심 원인: e2e Playwright spec이 Vitest에 섞여 실행됨
- 일부 단위/통합 테스트는 통과, 일부 테스트 코드는 자체 결함 존재

### E2E 목록 확인
- `npm run test:e2e -- --list`: Playwright 테스트 116개 식별됨

---

## 10) 다음 작업 권장 순서

1. 보안 차단
- `profiles` RLS 정책 수정 (self-update 컬럼 제한)
- 관리자 변경 경로 서버 단일화

2. 즉시 버그 수정
- `meal_options` -> `tournament_meal_options` 교정

3. 테스트 체계 정상화
- Vitest에서 `e2e/**` 제외
- 실패 테스트(헤더/라우트 통합) 정비

4. 성능 개선
- N+1 제거 대상부터 우선 정리

5. DB 정합성 정리
- 적용 마이그레이션/실제 스키마 동기화
- 번호 정책 정리 및 단일 기준 스냅샷 갱신

---

## 11) 재시작 체크리스트

작업 재개 시 아래 순서로 빠르게 확인:

- [ ] `git status`로 작업 트리 확인
- [ ] `npm run build` 기본 성공 확인
- [ ] `npm run lint` 결과 스냅샷 재확인
- [ ] `npm run test -- --run` (분리 전/후 비교)
- [ ] `npm run test:e2e -- --list`로 E2E 인식 확인
- [ ] Supabase에서 `profiles`/`app_settings` 정책 및 테이블 존재 재검증

---

작성 메모:
- 이 문서는 2026-02-11 시점의 코드베이스/실행 결과 기준입니다.
- 이후 정책/스키마 반영 시 본 문서의 5~7장을 우선 업데이트하세요.
