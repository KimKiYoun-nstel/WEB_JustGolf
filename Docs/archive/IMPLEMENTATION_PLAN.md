# 구현 계획 (Implementation Plan)

**작성일**: 2026-02-09  
**기준 가이드**: GolfTour_DevGuide_LoginOnly_AdminOptions_v2.md  
**현재 상태**: Phase 1, 2 대부분 완료 + side_events 구현됨

---

## 📊 현재 구현 상태 vs 가이드 요구사항 비교

### ✅ 이미 구현된 것

| 항목 | 가이드 Phase | 현재 상태 | 비고 |
|------|-------------|----------|------|
| 대회 목록/상세 | Phase 1 | ✅ 완료 | **단, 비로그인 접근 가능 (가이드와 차이)** |
| 로그인/회원가입 | Phase 1 | ✅ 완료 | 이메일 인증 방식 |
| 신청/취소 | Phase 1 | ✅ 완료 | 닉네임+메모 입력 |
| 참가 현황 공개 | Phase 1 | ✅ 완료 | 닉네임+상태만 공개 |
| 관리자 대시보드 | Phase 2 | ✅ 완료 | `/admin` 가드 완료 |
| 대회 CRUD | Phase 2 | ✅ 완료 | 생성/수정/복제 |
| 대회 상태 관리 | Phase 2 | ✅ 완료 | draft/open/closed/done |
| 참가자 상태 변경 | Phase 2 | ✅ 완료 | applied/confirmed/waitlisted/canceled |
| 파일 업로드 | 선택 | ✅ 완료 | Storage + tournament_files 테이블 |
| 사전/사후 라운드 | 별도 구현 | ✅ 완료 | side_events + side_event_registrations |

### 🔄 수정 필요한 것

| 항목 | 이유 | 우선순위 |
|------|------|---------|
| **비로그인 차단** | 가이드는 로그인 전용 서비스 요구 | 🔴 높음 |
| RLS 정책 강화 | `using(true)` → `using(auth.role() = 'authenticated')` | 🔴 높음 |
| 카카오 로그인 | 가이드는 카카오 인증 권장 (이메일은 개발용) | 🟡 중간 |

### ❌ 미구현 항목

| 항목 | 가이드 Phase | 우선순위 | 비고 |
|------|-------------|---------|------|
| **식사 메뉴 옵션** | Phase 3 | 🔴 높음 | 관리자가 옵션 생성 → 참가자 선택 |
| **추가정보 (카풀/이동/출발지/비고)** | Phase 3 | 🔴 높음 | registration_extras 테이블 필요 |
| **조편성 웹 편집** | Phase 4 | 🟢 낮음 | tournament_groups + members |
| **조편성 공개(publish)** | Phase 4 | 🟢 낮음 | is_published 기반 공개 제어 |

---

## 🎯 구현 우선순위 및 작업 순서

### Priority 1: 서비스 정책 변경 (비로그인 차단)
**목적**: 가이드의 핵심 정책 준수  
**영향 범위**: 전체 서비스 접근 정책

#### 1.1 프론트엔드 가드
- [ ] Next.js middleware 추가: `/login` 외 모든 페이지 로그인 체크
- [ ] 또는 root layout에서 세션 체크 후 리다이렉트
- [ ] 테스트: 비로그인 접속 시 `/login`으로 강제 이동

#### 1.2 RLS 정책 강화
- [ ] `tournaments` 테이블 SELECT 정책 수정
  ```sql
  -- 기존: using(true)
  -- 변경: using(auth.role() = 'authenticated')
  ```
- [ ] `registrations` 테이블 동일 수정
- [ ] `side_events`, `side_event_registrations` 동일 수정
- [ ] `tournament_files` 동일 수정
- [ ] 마이그레이션 파일 생성: `004_enforce_authentication.sql`

#### 1.3 UX 개선
- [ ] Header 컴포넌트에 "로그인 전용 서비스" 안내 추가 (선택)
- [ ] 로그인 페이지에 서비스 설명 추가

**예상 소요**: 1-2시간  
**테스트**: 비로그인 → 모든 페이지 접근 차단 확인

---

### Priority 2: 식사 메뉴 옵션 (Phase 3-A)
**목적**: 관리자가 대회별 메뉴 옵션을 만들고 참가자가 선택  
**영향 범위**: 대회 관리 + 신청 흐름

#### 2.1 DB 설계 및 마이그레이션
- [ ] `tournament_meal_options` 테이블 생성
  ```sql
  tournament_meal_options (
    id bigint primary key,
    tournament_id bigint references tournaments,
    menu_name text not null,
    is_active boolean default true,
    display_order int,
    created_at timestamptz
  )
  ```
- [ ] RLS 정책:
  - SELECT: 로그인 사용자 전체 (`auth.role() = 'authenticated'`)
  - INSERT/UPDATE/DELETE: 관리자만 (`profiles.is_admin = true`)
- [ ] 마이그레이션 파일: `005_meal_options.sql`

#### 2.2 관리자 UI (`/admin/tournaments/[id]/meal-options`)
- [ ] 메뉴 옵션 목록 표시
- [ ] 옵션 추가 폼 (menu_name 입력)
- [ ] 옵션 비활성화/활성화 토글
- [ ] 표시 순서 변경 (위/아래 버튼 또는 드래그)
- [ ] 삭제 기능 (soft delete: is_active=false 권장)

#### 2.3 참가자 신청 폼 수정
- [ ] `registrations` 테이블에 `meal_option_id` 컬럼 추가 (nullable)
- [ ] `/t/[id]` 신청 섹션에 식사 메뉴 select dropdown 추가
- [ ] 활성화된 메뉴 옵션만 표시
- [ ] 신청 시 선택한 meal_option_id 저장
- [ ] 신청 현황에 식사 선택 표시 (선택)

#### 2.4 관리자 참가자 목록 확장
- [ ] `/admin/tournaments/[id]/registrations`에 식사 메뉴 컬럼 추가
- [ ] 엑셀 다운로드 시 식사 메뉴 포함 (선택)

**예상 소요**: 3-4시간  
**테스트**: 
- 관리자: 메뉴 옵션 생성/수정/비활성화
- 참가자: 메뉴 선택하여 신청
- 관리자: 참가자별 메뉴 선택 확인

---

### Priority 3: 추가정보 (카풀/이동/출발지/비고) (Phase 3-B)
**목적**: 참가자가 카풀/이동수단 등 추가정보 입력, 민감도 고려한 공개 범위 설정  
**영향 범위**: 신청 흐름 + 권한 정책

#### 3.1 DB 설계 및 마이그레이션
- [ ] `registration_extras` 테이블 생성
  ```sql
  registration_extras (
    id bigint primary key,
    registration_id bigint references registrations unique,
    carpool_available boolean,          -- 카풀 가능 여부
    carpool_seats int,                  -- 제공 가능 좌석
    transportation text,                -- 이동수단
    departure_location text,            -- 출발지
    notes text,                         -- 비고
    created_at timestamptz,
    updated_at timestamptz
  )
  ```
- [ ] RLS 정책 (기본: 본인+관리자만 조회):
  ```sql
  SELECT: 
    본인: registration_id IN (SELECT id FROM registrations WHERE user_id = auth.uid())
    관리자: profiles.is_admin = true
  INSERT/UPDATE: 본인만
  ```
- [ ] (카풀 매칭 필요 시) 별도 VIEW 생성: `view_carpool_public`
  - carpool_available, carpool_seats만 공개
  - 로그인 사용자 전체 조회 가능
- [ ] 마이그레이션 파일: `006_registration_extras.sql`

#### 3.2 참가자 UI
- [ ] `/t/[id]` 신청 폼에 추가정보 섹션 추가
  - 카풀 제공 가능 (checkbox)
  - 좌석 수 (1~4 select)
  - 이동수단 (자차/카풀/렌트/대중교통 등 select 또는 input)
  - 출발지 (text input)
  - 비고 (textarea)
- [ ] 신청 시 `registration_extras` upsert
- [ ] 기존 신청자는 추가로 수정 가능

#### 3.3 카풀 매칭 페이지 (선택)
- [ ] `/t/[id]/carpool` 페이지 생성
- [ ] view_carpool_public 기반으로 카풀 제공자 목록 표시
- [ ] 닉네임 + 좌석 수만 공개
- [ ] 매칭은 댓글/메시지 기능으로 확장 가능 (Phase 5+)

#### 3.4 관리자 UI
- [ ] `/admin/tournaments/[id]/registrations`에 추가정보 컬럼 추가
- [ ] 상세보기 버튼 클릭 시 전체 정보 표시 (Dialog)
- [ ] 엑셀 다운로드 시 추가정보 포함

**예상 소요**: 4-5시간  
**테스트**:
- 참가자: 신청 시 추가정보 입력/수정
- 권한: 다른 사용자 extras 조회 불가 확인
- 관리자: 전체 extras 조회 가능
- (선택) 카풀 페이지에서 공개 정보만 표시

---

### Priority 4: 조편성 웹 편집 (Phase 4)
**목적**: 파일이 아닌 웹에서 조편성 편집, publish 기반 공개 제어  
**영향 범위**: 신규 관리자 기능 + 참가자 열람 페이지

#### 4.1 DB 설계 및 마이그레이션
- [ ] `tournament_groups` 테이블 생성
  ```sql
  tournament_groups (
    id bigint primary key,
    tournament_id bigint references tournaments,
    group_no int not null,              -- 1조, 2조...
    tee_time text,                      -- 티오프 시간 (선택)
    is_published boolean default false, -- 공개 여부
    notes text,
    created_at timestamptz,
    unique(tournament_id, group_no)
  )
  ```
- [ ] `tournament_group_members` 테이블 생성
  ```sql
  tournament_group_members (
    id bigint primary key,
    group_id bigint references tournament_groups,
    registration_id bigint references registrations,
    position int not null check(position between 1 and 4),
    role text,                          -- 조장 등 (선택)
    created_at timestamptz,
    unique(group_id, position)
  )
  ```
- [ ] RLS 정책:
  - SELECT (groups):
    - 관리자: 전체
    - 일반: is_published=true만
  - SELECT (members): groups와 동일 (JOIN 기반)
  - INSERT/UPDATE/DELETE: 관리자만
- [ ] 마이그레이션 파일: `007_tournament_groups.sql`

#### 4.2 관리자 조편성 UI (`/admin/tournaments/[id]/groups`)
- [ ] 조 목록 표시 (1조, 2조... 카드형)
- [ ] 조 생성 버튼 (group_no 자동 증가)
- [ ] 조 삭제 버튼 (확정된 참가자만 배정 권장)
- [ ] 참가자 목록 표시 (confirmed 상태만)
- [ ] 드래그앤드롭 또는 select로 멤버 배정
  - 조 선택 + position(1~4) 선택
- [ ] 멤버 이동/제거
- [ ] 티오프 시간 입력 (조별)
- [ ] **Publish 버튼**
  - 클릭 시 `is_published=true` 업데이트
  - 확인 다이얼로그: "조편성을 공개하시겠습니까?"
- [ ] Unpublish 기능 (수정 필요 시)

#### 4.3 참가자 조편성 열람 UI (`/t/[id]/groups`)
- [ ] is_published=true인 조만 표시
- [ ] 조별 카드 레이아웃
  - 조 번호 (1조, 2조...)
  - 티오프 시간
  - 멤버 목록 (닉네임 + position)
  - 조장 표시 (role 기반, 선택)
- [ ] publish 전: "아직 조편성이 공개되지 않았습니다" 메시지
- [ ] 네비게이션: 대회 상세 페이지에 "조편성 보기" 링크 추가

#### 4.4 UX 개선
- [ ] 관리자 대시보드에 "조편성" 퀵링크 추가
- [ ] 대회 상태가 'closed' 이상일 때만 조편성 편집 권장 (가이드)
- [ ] 조 생성 시 자동으로 빈 슬롯(1~4) 생성

**예상 소요**: 6-8시간  
**테스트**:
- 관리자: 조 생성, 멤버 배정, Publish
- 일반: Publish 전 조편성 보기 차단, Publish 후 열람
- 권한: 비관리자는 조편성 편집 불가

---

### Priority 5: 카카오 로그인 (선택 사항)
**목적**: 가이드 권장 인증 방식  
**영향 범위**: 로그인 흐름

#### 5.1 Supabase 설정 (수동)
- [ ] Kakao Developers에서 앱 등록
- [ ] Supabase → Authentication → Providers → Kakao 활성화
- [ ] Redirect URI 설정 (Supabase 콜백 URL)
- [ ] 배포 URL(Vercel) 반영

#### 5.2 프론트엔드
- [ ] `/login` 페이지에 카카오 로그인 버튼 추가
- [ ] `signInWithOAuth({provider: 'kakao'})` 구현
- [ ] 이메일 로그인은 개발 모드에서만 표시 (환경변수 기반)

**예상 소요**: 2-3시간  
**테스트**: 카카오 계정으로 로그인 → 프로필 자동 생성

---

## 📅 단계별 구현 일정 (예상)

| 단계 | 작업 | 예상 소요 | 누적 |
|------|------|---------|------|
| **P1** | 비로그인 차단 (Middleware + RLS) | 1-2h | 2h |
| **P2** | 식사 메뉴 옵션 (DB + UI) | 3-4h | 6h |
| **P3** | 추가정보 (DB + UI + 권한) | 4-5h | 11h |
| **P4** | 조편성 (DB + 편집 UI + 공개 UI) | 6-8h | 19h |
| **P5** | 카카오 로그인 (선택) | 2-3h | 22h |

**총 예상 시간**: 약 19~22시간 (카카오 포함 시)

---

## 🚀 실행 계획 (Execution Plan)

### Step 1: 비로그인 차단 구현
1. 현재 작업 브랜치 생성: `git checkout -b feature/enforce-login`
2. Middleware 또는 Layout 가드 구현
3. RLS 정책 마이그레이션 파일 작성 (`004_enforce_authentication.sql`)
4. 테스트 후 커밋/푸시
5. 가이드: "P1 완료 - 로그인 전용 서비스 전환"

### Step 2: 식사 메뉴 옵션
1. 브랜치 생성: `git checkout -b feature/meal-options`
2. 마이그레이션 작성 (`005_meal_options.sql`)
3. Supabase SQL Editor에서 실행
4. 관리자 UI 구현 (`/admin/tournaments/[id]/meal-options`)
5. 참가자 폼 수정 (`/t/[id]` - 식사 선택 추가)
6. 테스트 후 커밋/푸시
7. 가이드: "P2 완료 - Phase 3-A 식사 메뉴"

### Step 3: 추가정보
1. 브랜치 생성: `git checkout -b feature/registration-extras`
2. 마이그레이션 작성 (`006_registration_extras.sql`)
3. RLS 정책 신중히 설정 (본인+관리자만)
4. UI 구현 (신청 폼 + 관리자 상세보기)
5. (선택) 카풀 매칭 페이지
6. 테스트 후 커밋/푸시
7. 가이드: "P3 완료 - Phase 3-B 추가정보"

### Step 4: 조편성
1. 브랜치 생성: `git checkout -b feature/tournament-groups`
2. 마이그레이션 작성 (`007_tournament_groups.sql`)
3. 관리자 편집 UI (`/admin/tournaments/[id]/groups`)
4. 참가자 열람 UI (`/t/[id]/groups`)
5. Publish 로직 구현
6. 대회 상세 페이지에 "조편성 보기" 링크 추가
7. 테스트 후 커밋/푸시
8. 가이드: "P4 완료 - Phase 4 조편성"

### Step 5: (선택) 카카오 로그인
1. 브랜치 생성: `git checkout -b feature/kakao-auth`
2. Supabase 설정 (수동 작업)
3. 프론트엔드 구현
4. 테스트 후 커밋/푸시
5. 가이드: "P5 완료 - 카카오 인증"

---

## ✅ 체크리스트 (구현 시 확인 사항)

### 공통
- [ ] 모든 DB 변경은 마이그레이션 파일로 관리
- [ ] RLS 정책은 Supabase에서 직접 실행 (코드에서 SQL 실행 금지)
- [ ] 각 Phase 완료 시 테스트 + 커밋 + 푸시

### 비로그인 차단
- [ ] `/login` 외 모든 경로 가드
- [ ] 로그인 후 이전 페이지로 복귀 (UX)
- [ ] RLS 정책으로 DB 레벨 차단 병행

### 식사 메뉴
- [ ] 관리자가 옵션 수정해도 기존 신청 데이터 유지
- [ ] 비활성화된 메뉴는 신청 폼에서 숨김

### 추가정보
- [ ] 본인 외 조회 불가 (RLS로 강제)
- [ ] 카풀 매칭 시 최소 정보만 공개

### 조편성
- [ ] Publish 전에는 일반 사용자 조회 불가
- [ ] 조 수정 시 Unpublish → 수정 → Publish 워크플로우
- [ ] 멤버 배정 시 중복 방지 (1인 1조)

---

## 📝 참고 사항

### 기존 side_events와의 관계
- 현재 구현된 `side_events` (사전/사후 라운드)는 유지
- 가이드의 Phase 3는 "식사 메뉴 + 추가정보"이므로 **병렬 구조**
- 혼동 방지: side_events는 별도 이벤트, meal/extras는 본 대회 신청 확장

### 배포 전 확인 사항
- [ ] Vercel 환경변수 설정 (Supabase URL/Key)
- [ ] Supabase RLS 정책 재점검
- [ ] 카카오 로그인 Redirect URI (Production)
- [ ] 관리자 계정 is_admin=true 설정
- [ ] 테스트 데이터 정리 (운영 배포 시)

### 성능 최적화 (추후)
- [ ] 조편성 조회 VIEW 생성 (JOIN 간소화)
- [ ] 대회 목록 페이지네이션
- [ ] 이미지 최적화 (next/image)
- [ ] API 응답 캐싱 (ISR)

---

## 🎯 다음 작업

**즉시 시작 가능**: Priority 1 (비로그인 차단)  
**담당자 확인 필요**: 카풀 매칭 페이지 공개 범위 정책  
**질문 사항**: 
1. 카카오 로그인 구현 우선순위? (P5는 선택)
2. 식사 메뉴 외 다른 옵션 필요? (예: 캐디비 유무, 컴페 참여 등)
3. 조편성 드래그앤드롭 UI vs 간단한 select 방식?

---

**작성자**: AI Agent  
**검토 필요**: 사용자 확인 후 P1부터 순차 진행
