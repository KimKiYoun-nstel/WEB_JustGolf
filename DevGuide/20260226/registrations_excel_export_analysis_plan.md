# 확정 신청자 엑셀 다운로드 기능 분석 및 설계 계획

작성일: 2026-02-26  
대상 프로젝트: WEB_JustGolf (Next.js App Router + Supabase + Vercel)

## 1. 착수 전 요약 (요구사항 → 영향 파일 → 데이터/권한 영향 → 테스트 전략)
### 요구사항
- 관리자 화면에서 **확정 대상(status=approved)** 신청자 정보를 엑셀로 다운로드.
- 필요한 컬럼: **닉네임 / 이름 / 식사메뉴 / 전화번호**.
- 향후 조편성 완료 시점에는 **조편성 단위**로도 엑셀 생성.
- 회원 신청자라면 회원 정보(프로필/연락처) 통합 가능 여부 검토.

### 영향 파일(예상)
- UI:
  - `app/admin/tournaments/[id]/registrations/page.tsx` (다운로드 버튼, 모드 선택)
  - (향후) `app/admin/tournaments/[id]/groups/page.tsx` (조편성 단위 다운로드 진입점)
- API:
  - 신규 `app/api/admin/tournaments/[id]/registrations/export/route.ts` (권장)
- 공통 서버 권한:
  - `lib/apiGuard.ts` 패턴 재사용 (`requireApiUser`, `createServiceRoleSupabaseClient`)

### 데이터/권한(RLS) 영향
- DB 스키마를 즉시 변경하지 않아도 1차 구현 가능.
- 전화번호는 현재 주로 `auth.users.user_metadata.phone`에 저장되므로, 관리자 API에서 Service Role 기반 조회가 필요.
- 관리자/일반/비로그인 플로우를 API에서 강제:
  - 관리자만 다운로드 허용
  - 일반 사용자 403
  - 비로그인 401

### 테스트 전략
- API 단위 검증 + UI 스모크 + `npm run build` 게이트.
- 개인정보 필드 누락/빈값 처리, 조편성 미완료 상태 처리, 권한 차단을 필수 검증.

---

## 2. 현재 데이터 자산 분석
## 2.1 확정 신청자 기본 데이터
- 소스: `registrations`
- 사용 상태값: `status = 'approved'` (관리자 신청자 페이지/조편성 페이지 모두 동일 기준 사용)
- 확보 가능:
  - 닉네임: `registrations.nickname`
  - 식사메뉴 FK: `registrations.meal_option_id`
  - 회원 여부: `registrations.user_id` (`NULL`이면 제3자)
  - 등록자: `registrations.registering_user_id`

## 2.2 식사 메뉴명
- 소스: `tournament_meal_options`
- 매핑: `registrations.meal_option_id -> tournament_meal_options.id`
- 확보 가능:
  - 식사메뉴명: `menu_name`

## 2.3 이름/전화번호 (회원 정보 통합 가능성)
- 이름:
  - `profiles.full_name` 사용 가능
  - 보조 컬럼으로 `profiles.real_name` 존재(과거 마이그레이션)
  - `auth.users.user_metadata.full_name`도 일부 사용자에 존재 가능
- 전화번호:
  - `profiles.phone` 컬럼은 존재하나, 현재 앱 저장 경로는 주로 `auth.users.user_metadata.phone`
  - 현재 코드(`profile`, `onboarding`)는 전화번호를 auth metadata에 업데이트

### 결론
- **회원(user_id not null)**: 이름/전화번호 통합 가능 (Service Role API에서 조회 시 가능)
- **제3자(user_id null)**: 현재 스키마로는 참가자 본인의 이름/전화번호가 구조적으로 없음
  - 보유값: 닉네임, 관계(`relation`), 등록자(`registering_user_id`)
  - 즉, 요청 컬럼 중 이름/전화번호는 공란 처리 또는 등록자 기준 대체 규칙 필요

---

## 3. 조편성 단위 확장 가능성 분석
## 3.1 조편성 저장 구조
- `tournament_groups`: `group_no`, `tee_time`, `is_published`
- `tournament_group_members`: `group_id`, `registration_id`, `position`
- `registration_id`가 `registrations`와 연결되므로, 조편성 이후에도 동일하게 식사/이름/전화 연결 가능

## 3.2 확장 결론
- 조편성 완료 후 엑셀 생성은 현재 스키마로 충분히 가능.
- 그룹 기반 엑셀에서 추가 가능한 컬럼:
  - 조 번호(`group_no`), 포지션(`position`), 티오프시간(`tee_time`)
  - 기존 요청 컬럼(닉네임/이름/식사메뉴/전화번호)

---

## 4. 권한/보안 설계
## 4.1 접근 제어
- Route Handler에서 `requireApiUser({ requireAdmin: true })` 적용.
- 이후 데이터 조회는 `createServiceRoleSupabaseClient()` 사용.

## 4.2 RLS 및 개인정보
- Service Role은 RLS 우회 가능하므로, 반드시 관리자 검증 이후에만 수행.
- 응답 필드는 다운로드 목적 최소 필드로 제한.
- 서버 로그/에러 메시지에 전화번호 등 민감정보 직접 노출 금지.

## 4.3 엑셀 보안
- Excel Formula Injection 대응 필요:
  - 셀 값이 `=`, `+`, `-`, `@`로 시작하면 앞에 `'` 프리픽스 부여.

---

## 5. 기능 설계안
## 5.1 API 설계 (권장)
- 엔드포인트:
  - `GET /api/admin/tournaments/[id]/registrations/export?scope=approved&format=xlsx`
  - `GET /api/admin/tournaments/[id]/registrations/export?scope=grouped&format=xlsx`
- 응답:
  - `Content-Type: application/vnd.openxmlformats-officedocument.spreadsheetml.sheet`
  - `Content-Disposition: attachment; filename="justgolf_t{ID}_{scope}_{YYYYMMDD_HHmm}.xlsx"`

## 5.2 데이터 조합 규칙
- 공통 기본:
  - `registrations` + `tournament_meal_options`
- 회원(user_id not null):
  - 이름 우선순위: `profiles.full_name` -> `profiles.real_name` -> `auth.user_metadata.full_name` -> `""`
  - 전화 우선순위: `profiles.phone` -> `auth.user_metadata.phone` -> `""`
- 제3자(user_id null):
  - 이름/전화 기본값 `""`
  - 선택적으로 `관계(relation)` 컬럼 추가 가능

## 5.3 엑셀 시트 구성 제안
- `scope=approved`:
  - Sheet1: `확정자`
  - 컬럼: 번호, 닉네임, 이름, 식사메뉴, 전화번호, 구분(회원/제3자), 등록자
- `scope=grouped`:
  - Sheet1: `조편성`
  - 컬럼: 조, 포지션, 닉네임, 이름, 식사메뉴, 전화번호, 티오프시간
  - (선택) Sheet2: `미배정 확정자` (승인됐지만 조 미배정)

## 5.4 UI 설계
- `registrations` 페이지 상단 액션에 `엑셀 다운로드` 버튼 추가.
- 드롭다운/세그먼트로 `확정자 기준` vs `조편성 기준` 선택.
- `조편성 기준` 선택 시:
  - 조 데이터가 없으면 비활성 + 안내 토스트 (`조편성 데이터가 없습니다.`)

---

## 6. 구현 단계 계획
## Phase 1: 확정자 엑셀 다운로드 (MVP)
- 관리자 API route 구현
- `scope=approved` 쿼리 + 파일 생성 + 다운로드 버튼 연결
- 제3자 이름/전화 공란 정책 적용

## Phase 2: 조편성 단위 엑셀
- `scope=grouped` 쿼리 구현 (`tournament_groups`, `tournament_group_members` 조인)
- 그룹 정렬(조 번호, 포지션) 및 티오프시간 포함

## Phase 3: 데이터 품질 보강 (선택)
- 제3자 연락처까지 필요하면 스키마 확장 검토:
  - 예: `registrations.participant_name`, `registrations.participant_phone`
- 프로필 전화번호 저장 위치 일원화 검토(auth metadata + profiles 동기화)

---

## 7. 테스트 계획
## 7.1 자동 검증
- API 테스트:
  - 관리자 권한 성공(200, 파일 헤더)
  - 일반 사용자 403
  - 비로그인 401
  - 데이터 없음/미배정 케이스 처리
- 빌드 게이트:
  - `npm run build` 성공 필수

## 7.2 수동 QA 시나리오
1. 확정자 1명 이상 대회에서 `확정자 기준` 엑셀 다운로드 성공
2. 회원/제3자가 섞인 대회에서 회원만 이름/전화가 채워지고 제3자는 공란 처리 확인
3. 조편성 완료 대회에서 `조편성 기준` 파일에 조/포지션/티오프시간이 반영되는지 확인
4. 조편성 미완료 대회에서 `조편성 기준` 요청 시 안내 메시지/비활성 동작 확인
5. 관리자 외 계정에서 다운로드 시 차단 확인

---

## 8. 오픈 이슈 (결정 필요)
1. 제3자 행의 이름/전화를 공란으로 둘지, 등록자 연락처로 대체할지 정책 결정 필요
2. 조편성 기준 파일에서 시트 구성을 단일 시트로 할지, 조별 시트 분리할지 결정 필요
3. 출력 포맷을 xlsx로 고정할지, csv 동시 지원할지 결정 필요

---

## 9. 최종 판단
- **기능 구현 가능**.
- 현재 스키마/코드 기반으로 1차 구현(확정자 xlsx + 회원정보 통합)은 무리 없이 가능.
- 다만 제3자 이름/전화는 원천 데이터가 부족하므로 정책(공란/대체/스키마확장) 결정이 필요.
