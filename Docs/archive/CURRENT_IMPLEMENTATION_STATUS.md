# WEB_JustGolf 프로젝트 현시점 구현 상태 보고서

**작성일:** 2026-02-10  
**버전:** Phase 5 완료 후  
**프로젝트:** Golf Tour 대회 관리 시스템  

---

## 📊 프로젝트 개요

### 기술 스택
- **Frontend:** Next.js 16.1.6 (App Router), React 19.2.3, TypeScript 5
- **Backend:** Supabase (Auth + PostgreSQL)
- **UI:** Tailwind CSS 4, shadcn/ui
- **Testing:** Vitest 4.0.18, @testing-library/react
- **Deployment:** Vercel

### 핵심 기능
1. 로그인 전용 서비스 (비로그인 차단)
2. 대회 생성/관리 (관리자)
3. 대회 신청/취소 (사용자)
4. 회원 승인 시스템
5. 식사 메뉴 옵션 관리
6. 사전/사후 라운드 관리
7. 조편성 관리
8. 다중 참가자 신청

---

## 🗄️ 데이터베이스 스키마

**근거:** Supabase Dashboard에서 Export한 스키마 ([db/supabase_shcema.slq](db/supabase_shcema.slq))

### 1. profiles (회원)
**컬럼:**
- `id` (uuid, PK) - auth.users 참조
- `nickname` (text, NOT NULL)
- `full_name` (text)
- `is_admin` (boolean, default: false)
- `is_approved` (boolean, default: false) - 회원 승인 여부
- `email` (text)
- `created_at`, `updated_at` (timestamptz)

**RLS:** 로그인 사용자만 조회 가능  
**관계:** auth.users와 1:1

---

### 2. tournaments (대회)
**컬럼:**
- `id` (bigint, PK)
- `title` (text, NOT NULL)
- `course_name`, `location` (text)
- `event_date` (date, NOT NULL)
- `tee_time`, `notes` (text)
- `open_at`, `close_at` (timestamptz) - 신청 기간
- `status` (text) - 'draft', 'open', 'closed', 'done'
- `created_by` (uuid) - auth.users 참조
- `created_at`, `updated_at` (timestamptz)

**RLS:** 로그인 사용자 조회, 관리자만 쓰기  
**관계:** 
- → registrations (1:N)
- → side_events (1:N)
- → tournament_meal_options (1:N)
- → tournament_files (1:N)
- → tournament_groups (1:N)

---

### 3. registrations (본대회 신청)
**컬럼:**
- `id` (bigint, PK)
- `tournament_id` (bigint, FK → tournaments)
- `user_id` (uuid, FK → auth.users)
- `nickname` (text, NOT NULL)
- `status` (text) - 'applied', 'waitlisted', 'approved', 'canceled', 'undecided'
- `memo` (text)
- `meal_option_id` (bigint, FK → tournament_meal_options)
- `approval_status` (varchar) - 'pending', 'approved', 'rejected'
- `approved_at` (timestamp)
- `approved_by` (uuid, FK → auth.users)
- `relation` (text) - '본인', '가족', '지인' 등 (다중 참가자 구분)
- `created_at`, `updated_at` (timestamptz)
- UNIQUE(tournament_id, user_id) - 제거됨 (다중 참가자 지원)

**RLS:** 로그인 사용자 조회, 본인 수정, 관리자 모두 수정  

---

### 4. registration_extras (신청 추가 정보)
**컬럼:**
- `id` (bigint, PK)
- `registration_id` (bigint, FK → registrations, UNIQUE)
- `carpool_available` (boolean, default: false)
- `carpool_seats` (int)
- `transportation` (text) - 이동수단
- `departure_location` (text) - 출발지
- `notes` (text) - 비고
- `created_at`, `updated_at` (timestamptz)

**RLS:** 본인+관리자만 조회/수정  
**관계:** registrations와 1:1

---

### 5. side_events (사전/사후 라운드)
**컬럼:**
- `id` (bigint, PK)
- `tournament_id` (bigint, FK → tournaments)
- `round_type` (text) - 'pre', 'post'
- `title` (text, NOT NULL)
- `tee_time`, `location`, `notes` (text)
- `open_at`, `close_at` (timestamptz)
- `max_participants` (int)
- `meal_option_id` (bigint, FK → tournament_meal_options)
- `lodging_available`, `lodging_required` (boolean)
- `status` (text) - 'draft', 'open', 'closed', 'done'
- `created_by` (uuid)
- `created_at`, `updated_at` (timestamptz)

**RLS:** 로그인 사용자 조회, 관리자만 쓰기  

---

### 6. side_event_registrations (라운드 신청)
**컬럼:**
- `id` (bigint, PK)
- `side_event_id` (bigint, FK → side_events)
- `user_id` (uuid, FK → auth.users)
- `nickname` (text, NOT NULL)
- `status` (text) - 'applied', 'confirmed', 'waitlisted', 'canceled'
- `memo` (text)
- `meal_selected` (boolean, default: false)
- `lodging_selected` (boolean, default: false)
- `created_at`, `updated_at` (timestamptz)
- UNIQUE(side_event_id, user_id)

**RLS:** 로그인 사용자 조회, 본인 수정, 관리자 모두 수정  

---

### 7. tournament_meal_options (식사 메뉴 옵션)
**컬럼:**
- `id` (bigint, PK)
- `tournament_id` (bigint, FK → tournaments)
- `menu_name` (text, NOT NULL)
- `is_active` (boolean, default: true)
- `display_order` (int, default: 0)
- `created_at`, `updated_at` (timestamptz)

**RLS:** 로그인 사용자 조회, 관리자만 쓰기  
**용도:** 관리자가 대회별로 메뉴를 생성하면 참가자가 선택

---

### 8. tournament_files (파일 관리)
**컬럼:**
- `id` (bigint, PK)
- `tournament_id` (bigint, FK → tournaments)
- `file_type` (text) - 'groups', 'notice', 'other'
- `file_name` (text, NOT NULL)
- `storage_path` (text, NOT NULL) - Supabase Storage 경로
- `is_public` (boolean, default: true)
- `uploaded_by` (uuid)
- `created_at` (timestamptz)

**RLS:** 로그인 사용자 조회, 관리자만 쓰기  

---

### 9. tournament_groups (조편성 - 조 정보)
**컬럼:**
- `id` (bigint, PK)
- `tournament_id` (bigint, FK → tournaments)
- `group_no` (int) - 조 번호
- `tee_time` (text)
- `is_published` (boolean, default: false) - 공개 여부
- `notes` (text)
- `created_at`, `updated_at` (timestamptz)

**RLS:** 로그인 사용자는 published된 조만 조회, 관리자는 모두 조회/수정  

---

### 10. tournament_group_members (조편성 - 조 멤버)
**컬럼:**
- `id` (bigint, PK)
- `group_id` (bigint, FK → tournament_groups)
- `registration_id` (bigint, FK → registrations)
- `position` (int) - 조 내 순서 (1~4)
- `role` (text) - 조장 등
- `created_at` (timestamptz)

**RLS:** 로그인 사용자는 published된 조의 멤버만 조회, 관리자는 모두 조회/수정  

---

### 11. tournament_extras (대회별 추가 활동)
**컬럼:**
- `id` (bigint, PK)
- `tournament_id` (bigint, FK → tournaments)
- `activity_name` (varchar)
- `description` (text)
- `display_order` (int, default: 0)
- `is_active` (boolean, default: true)
- `created_at`, `updated_at` (timestamp)

**RLS:** 로그인 사용자 조회, 관리자만 쓰기  

---

### 12. registration_activity_selections (추가 활동 선택)
**컬럼:**
- `id` (bigint, PK)
- `registration_id` (bigint, FK → registrations)
- `extra_id` (bigint, FK → tournament_extras)
- `selected` (boolean, default: true)
- `created_at`, `updated_at` (timestamp)

**RLS:** 로그인 사용자 본인 + 관리자  

---

### 13. manager_permissions (라운드 관리자 권한)
**컬럼:**
- `id` (bigint, PK)
- `user_id` (uuid, FK → auth.users)
- `tournament_id` (bigint, FK → tournaments)
- `can_manage_side_events` (boolean, default: false)
- `granted_at`, `granted_by`, `revoked_at`, `revoked_by`

**RLS:** 관리자만 부여/관리  

---

### 14. tournament_prize_supports (경품 지원)
**컬럼:**
- `id` (int, PK)
- `tournament_id` (int, FK → tournaments)
- `user_id` (uuid, FK → auth.users)
- `item_name` (text)
- `note` (text)
- `supporter_nickname` (text)
- `created_at`, `updated_at` (timestamptz)

**RLS:** 로그인 사용자 조회, 관리자/작성자 쓰기  

---

### 15. feedbacks (게시판)
**컬럼:**
- `id` (int, PK)
- `user_id` (uuid, FK → auth.users)
- `title` (text)
- `content` (text)
- `category` (text, default: 'general')
- `status` (text, default: 'pending')
- `nickname` (text)
- `created_at`, `updated_at` (timestamptz)

**RLS:** 로그인 사용자 조회/작성, 관리자 상태 변경  

---

### 16. audit_logs (감사 로그)
**컬럼:**
- `id` (bigint, PK)
- `entity_type`, `entity_id`, `action`
- `actor_id` (uuid)
- `before`, `after` (jsonb)
- `created_at` (timestamptz)

**RLS:** 관리자만 조회  

---

## 🌐 웹 Route 구조

### 공개 Route
| Route | 파일 | 기능 | 사용 테이블 |
|-------|------|------|------------|
| `/login` | `app/login/page.tsx` | 로그인/회원가입 | profiles |

### 사용자 Route (로그인 필수)
| Route | 파일 | 기능 | 사용 테이블 |
|-------|------|------|------------|
| `/` | `app/page.tsx` | 루트 (리다이렉트) | - |
| `/start` | `app/start/page.tsx` | 시작 페이지 (바로가기 카드) | - |
| `/tournaments` | `app/tournaments/page.tsx` | 대회 목록 | tournaments, registrations |
| `/t/[id]` | `app/t/[id]/page.tsx` | 대회 상세 + 신청 | tournaments, registrations, registration_extras, side_events, side_event_registrations, tournament_meal_options, tournament_files, tournament_extras, registration_activity_selections, tournament_prize_supports |
| `/t/[id]/groups` | `app/t/[id]/groups/page.tsx` | 조편성 조회 (공개된 것만) | tournament_groups, tournament_group_members, registrations |
| `/t/[id]/participants` | `app/t/[id]/participants/page.tsx` | 참가자 현황 + 경품 목록 | registrations, side_event_registrations, tournament_prize_supports |
| `/t/[id]/status` | `app/t/[id]/status/page.tsx` | 참가 상태 (사용자 본인) | registrations, tournament_extras, registration_activity_selections |
| `/profile` | `app/profile/page.tsx` | 프로필 수정 | profiles |
| `/board` | `app/board/page.tsx` | 게시판 | feedbacks |
| `/jeju` | `app/jeju/page.tsx` | 제주 (placeholder) | - |

### 관리자 Route (is_admin=true 필수)
| Route | 파일 | 기능 | 사용 테이블 |
|-------|------|------|------------|
| `/admin` | `app/admin/page.tsx` | 관리자 대시보드 | - |
| `/admin/users` | `app/admin/users/page.tsx` | 회원 승인 관리 | profiles |
| `/admin/tournaments` | `app/admin/tournaments/page.tsx` | 대회 목록 (관리) | tournaments |
| `/admin/tournaments/new` | `app/admin/tournaments/new/page.tsx` | 대회 생성 | tournaments |
| `/admin/tournaments/[id]/edit` | `app/admin/tournaments/[id]/edit/page.tsx` | 대회 수정 | tournaments |
| `/admin/tournaments/[id]/dashboard` | `app/admin/tournaments/[id]/dashboard/page.tsx` | 대회 대시보드 | tournaments, registrations |
| `/admin/tournaments/[id]/registrations` | `app/admin/tournaments/[id]/registrations/page.tsx` | 신청자 관리 | registrations, registration_extras |
| `/admin/tournaments/[id]/extras` | `app/admin/tournaments/[id]/extras/page.tsx` | 추가 활동 관리 | tournament_extras |
| `/admin/tournaments/[id]/side-events` | `app/admin/tournaments/[id]/side-events/page.tsx` | 라운드 관리 | side_events, side_event_registrations |
| `/admin/tournaments/[id]/meal-options` | `app/admin/tournaments/[id]/meal-options/page.tsx` | 식사 메뉴 관리 | tournament_meal_options |
| `/admin/tournaments/[id]/files` | `app/admin/tournaments/[id]/files/page.tsx` | 파일 관리 | tournament_files |
| `/admin/tournaments/[id]/groups` | `app/admin/tournaments/[id]/groups/page.tsx` | 조편성 관리 | tournament_groups, tournament_group_members, registrations |
| `/admin/tournaments/[id]/manager-setup` | `app/admin/tournaments/[id]/manager-setup/page.tsx` | 대회 관리자 설정 | manager_permissions, profiles |

---

## 🔒 보안 설정

### 1. Next.js Middleware (proxy.ts)
**기능:** 비로그인 사용자 페이지 접근 차단  
**동작:** `/login` 외 모든 Route에서 세션 체크 → 없으면 `/login`으로 리다이렉트  
**파일:** `proxy.ts`

### 2. Supabase RLS (Row Level Security)
**활성화된 테이블:** 전체 16개 테이블  
**정책:**
- SELECT: `auth.role() = 'authenticated'` - 로그인 사용자만 조회
- INSERT/UPDATE/DELETE: 테이블별로 다름
  - registrations: 본인 + 관리자
  - registration_extras: 본인 + 관리자
  - tournament_groups: 관리자 + 공개된 조는 일반 사용자도 조회
  - 기타: 주로 관리자만

### 3. 회원 승인 시스템
**흐름:**
1. 회원가입 → `is_approved=false`
2. 관리자가 `/admin/users`에서 승인
3. 현재는 로그인에 승인 체크 안 함 (DevGuide 정책: 비밀번호만 맞으면 로그인)

---

## 🎨 주요 UX/UI 기능

### 1. 다중 참가자 신청
- 한 계정으로 여러 명 신청 가능 (본인, 가족, 지인)
- `registrations.relation` 컬럼으로 구분
- 각 참가자별로 별도 신청 레코드

### 2. 미정 상태 지원
- 신청 상태: `undecided` 추가
- 카풀: 삼항 (미정/제공/불가)
- 식사/숙박: 삼항 (미정/참여/불참)

### 3. 식사 메뉴 선택
- 관리자가 대회별로 메뉴 옵션 생성
- 참가자는 선택만 (자유 입력 불가)

### 4. 조편성 공개 제어
- 관리자가 조편성 완료 후 `is_published=true` 설정
- Published 전에는 일반 사용자에게 비공개

### 5. 참가 상태 표시
- 대회 목록: 각 대회별 본인 참가 상태 뱃지
- 신청/확정/대기/취소/미정 등 시각적 표시

---

## 🧪 테스트 환경

### 구성
- **Framework:** Vitest 4.0.18
- **Testing Library:** @testing-library/react 16.3.2
- **Environment:** happy-dom 20.5.3

### 기존 테스트
1. `app/login/login.test.tsx` - 로그인/회원가입 로직 (Mock 테스트)
2. `Test/test-real-supabase.mjs` - 실제 Supabase 연동 테스트
3. `Test/inspect-db-schema.mjs` - DB 스키마 조회

---

## 📌 현재 상태 요약

### ✅ 구현 완료
- [x] 회원가입/로그인 (이메일+비밀번호)
- [x] 비로그인 차단 (Middleware + RLS)
- [x] 회원 승인 시스템
- [x] 대회 CRUD (관리자)
- [x] 대회 신청/취소 (사용자)
- [x] 다중 참가자 신청
- [x] 미정 상태 지원
- [x] 식사 메뉴 옵션
- [x] 신청 추가 정보 (카풀 등)
- [x] 사전/사후 라운드
- [x] 조편성 웹 편집 + 공개
- [x] 파일 업로드 관리
- [x] 경품 지원 목록

### ⚠️ Placeholder (향후 구현)
- [ ] 제주 페이지 (`/jeju`)
- [ ] 알림 시스템

---

## ⚠️ 스키마-코드 불일치 확인 항목

1. `registrations.status`
  - DB: 'approved'
  - 코드/UX: 'confirmed'

2. 삼항 상태 컬럼
  - DB: `registration_extras.carpool_available`, `side_event_registrations.meal_selected`, `side_event_registrations.lodging_selected` 기본값 false
  - 코드/UX: null을 포함한 삼항 상태 사용

3. 승인 관련 컬럼
  - DB: `registrations.approval_status`, `approved_at`, `approved_by` 존재
  - 코드/UX: 아직 사용하지 않음

### 🔧 개선 필요
- [ ] Route별 통합 테스트 (Vitest)
- [ ] 에러 바운더리
- [ ] 로딩 상태 통일
- [ ] 반응형 디자인 최적화

---

## 📝 마이그레이션 이력

| 파일 | 날짜 | 내용 |
|------|------|------|
| `schema.sql` | 초기 | 기본 테이블 (profiles, tournaments, registrations, tournament_files, audit_logs) |
| `003_side_events.sql` | - | side_events, side_event_registrations 추가 |
| `004_enforce_authentication.sql` | - | RLS 정책 강화 |
| `005_meal_options.sql` | 2026-02-09 | tournament_meal_options 추가, registrations에 meal_option_id 추가 |
| `006_registration_extras.sql` | 2026-02-09 | registration_extras 테이블 추가 (카풀 등) |
| `007_tournament_groups.sql` | - | tournament_groups, tournament_group_members 추가 |
| `008_fix_profiles_rls.sql` | - | profiles RLS 정책 수정 |
| `009_approval_and_extras_system.sql` | - | 승인 시스템 RLS 적용 |
| `010_account_approval.sql` | 2026-02-09 | is_approved 컬럼 추가, 승인 관련 함수/정책 |
| `011_multi_participant_and_undecided.sql` | - | relation 컬럼 추가, undecided 상태 추가 |
| `012_profiles_email.sql` | - | profiles에 email 컬럼 추가 |
| `013_feedback_board.sql` | - | 게시판 관련 (미사용) |

---

**보고서 작성: GitHub Copilot**  
**최종 검토 필요 항목:**
- [ ] 각 Route의 상세 기능 확인
- [ ] 에러 처리 로직 점검
- [ ] UX 플로우 검증
