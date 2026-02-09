# Phase 4 구현 계획: 가입 승인 및 정보 수정 시스템

**문서 작성**: 2026년 2월 9일  
**상태**: 계획 수립 단계

---

## 1. 요구사항 분석

### 1.1 요구사항 목록

| # | 요구사항 | 우선순위 | 현재 구현 | 필요 작업 |
|---|---------|---------|---------|---------|
| 1 | 가입 승인 프로세스 (in-app 알림) | 높음 | 없음 | 신규 구현 |
| 2 | 사용자 정보 수정 페이지 | 높음 | 없음 | 신규 구현 |
| 3 | 참가 신청 페이지 버그 수정 (저장 버튼) | 최고 | 부분 구현 | 버그 수정 |
| 4 | 참가 현황 페이지 분리 | 높음 | 없음 | 신규 구현 |
| 5 | 라운드 관리자 권한 부여 | 중간 | 부분 | 확장 구현 |
| 6 | 라운드 추가 정보 (식사, 숙박) | 중간 | 부분 | 구현 |
| 7 | 참가신청 시 활동 선택 (최대 3개) | 중간 | 없음 | 신규 구현 |

---

## 2. 현재 상태 분석

### 2.1 구현되어 있는 것

| 항목 | 상세 | 파일 |
|------|------|------|
| **기본 가입** | Supabase Auth (이메일/비번) | `lib/auth.ts` |
| **자동 프로필** | 가입 시 profile 자동 생성 | `db/schema.sql` |
| **참가 신청** | 토너먼트별 등록 (applied 상태) | `app/t/[id]/page.tsx` |
| **식사 선택** | meal_options 테이블 및 선택 UI | `db/schema.sql`, `app/t/[id]/page.tsx` |
| **카풀 정보** | registration_extras 테이블 | `db/schema.sql`, `app/t/[id]/page.tsx` |
| **라운드 관리** | 관리자의 사전/사후 라운드 생성/관리 | `app/admin/tournaments/[id]/side-events/page.tsx` |
| **그룹 지정** | 관리자의 그룹 생성/할당/발행 | `app/admin/tournaments/[id]/groups/page.tsx` |

### 2.2 구현 안 된 것 (우리가 해야 할 것)

1. **승인 프로세스**
   - 가입신청 상태 분리: applied → 승인대기 → confirmed
   - Admin 대시보드에 승인대기 카운트
   - 개별/일괄 승인 버튼

2. **사용자 정보 수정**
   - Nickname, password, profile 수정 페이지
   - 전용 경로: `/profile` (비로그인 제외)

3. **참가 현황 조회**
   - 사용자용: `/t/[id]/status` (자신의 신청 현황만)
   - 관리자용: `/admin/tournaments/[id]/dashboard` (전체 + 통계)

4. **라운드 추가 정보**
   - side_events 테이블에 `meal_option_id`, `lodging_available` 컬럼 추가
   - 라운드별 식사/숙박 선택 UI

5. **활동 선택 시스템**
   - 새 테이블: `tournament_extras` (대회별 활동), `registration_activity_selections` (사용자 선택)
   - 참가신청 시 활동 선택 UI (최대 3개)

6. **라운드 관리자**
   - profiles 테이블에 `can_manage_side_events` 권한 추가
   - Tournament 단위 권한 부여 (tour1에선 O, tour2에선 X)

---

## 3. 데이터베이스 스키마 변경

### 3.1 신규 테이블

#### 3.1.1 `tournament_extras` - 토너먼트별 추가 활동
```sql
CREATE TABLE tournament_extras (
  id BIGSERIAL PRIMARY KEY,
  tournament_id BIGINT NOT NULL REFERENCES tournaments(id) ON DELETE CASCADE,
  activity_name VARCHAR(100) NOT NULL,
  description TEXT,
  display_order INT NOT NULL DEFAULT 0,
  is_active BOOLEAN DEFAULT TRUE,
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW()
);

CREATE UNIQUE INDEX idx_tournament_extras_unique 
  ON tournament_extras(tournament_id, activity_name);
```

#### 3.1.2 `registration_activity_selections` - 참가자의 활동 선택
```sql
CREATE TABLE registration_activity_selections (
  id BIGSERIAL PRIMARY KEY,
  registration_id BIGINT NOT NULL REFERENCES registrations(id) ON DELETE CASCADE,
  extra_id BIGINT NOT NULL REFERENCES tournament_extras(id) ON DELETE CASCADE,
  selected BOOLEAN DEFAULT TRUE,
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW()
);

CREATE UNIQUE INDEX idx_reg_activity_unique 
  ON registration_activity_selections(registration_id, extra_id);
```

#### 3.1.3 `manager_permissions` - 라운드 관리자 권한
```sql
CREATE TABLE manager_permissions (
  id BIGSERIAL PRIMARY KEY,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  tournament_id BIGINT NOT NULL REFERENCES tournaments(id) ON DELETE CASCADE,
  can_manage_side_events BOOLEAN DEFAULT FALSE,
  granted_at TIMESTAMP DEFAULT NOW(),
  granted_by UUID NOT NULL REFERENCES auth.users(id)
);

CREATE UNIQUE INDEX idx_manager_perm_unique 
  ON manager_permissions(user_id, tournament_id);
```

### 3.2 기존 테이블 변경

#### 3.2.1 `registrations` 테이블
```sql
-- 새 컬럼 추가
ALTER TABLE registrations ADD COLUMN 
  approval_status VARCHAR(20) DEFAULT 'pending' 
  CHECK (approval_status IN ('pending', 'approved', 'rejected'));

ALTER TABLE registrations ADD COLUMN 
  approved_at TIMESTAMP NULL;

ALTER TABLE registrations ADD COLUMN 
  approved_by UUID NULL REFERENCES auth.users(id);

-- 기존 'status' 컬럼: 'applied' 유지 (승인 후 confirmed/waitlisted/canceled)
```

#### 3.2.2 `side_events` 테이블
```sql
ALTER TABLE side_events ADD COLUMN 
  meal_option_id BIGINT NULL REFERENCES tournament_meal_options(id) ON DELETE SET NULL;

ALTER TABLE side_events ADD COLUMN 
  lodging_available BOOLEAN DEFAULT FALSE;

ALTER TABLE side_events ADD COLUMN 
  lodging_required BOOLEAN DEFAULT FALSE;
```

#### 3.2.3 `side_event_registrations` 테이블
```sql
ALTER TABLE side_event_registrations ADD COLUMN 
  meal_selected BOOLEAN DEFAULT FALSE;

ALTER TABLE side_event_registrations ADD COLUMN 
  lodging_selected BOOLEAN DEFAULT FALSE;
```

### 3.3 마이그레이션 파일 생성

파일: `db/migrations/009_approval_and_extras_system.sql`
- 위의 3개 신규 테이블 생성
- 기존 4개 테이블 컬럼 추가
- RLS policies 추가 (아래 설명)

---

## 4. RLS (Row-Level Security) 정책

### 4.1 신규 테이블 정책

#### `tournament_extras` 테이블
```sql
-- 공개 읽기 (모든 사용자)
CREATE POLICY select_tournament_extras ON tournament_extras 
  FOR SELECT USING (true);

-- 관리자/토너먼트 작성자만 쓰기
CREATE POLICY write_tournament_extras ON tournament_extras 
  FOR INSERT WITH CHECK (
    (SELECT is_admin FROM profiles WHERE id = auth.uid()) OR
    (SELECT created_by FROM tournaments WHERE id = tournament_id) = auth.uid()
  );
```

#### `registration_activity_selections` 테이블
```sql
-- 자신의 선택만 읽기
CREATE POLICY select_activity_selections ON registration_activity_selections 
  FOR SELECT USING (
    (SELECT user_id FROM registrations WHERE id = registration_id) = auth.uid() OR
    (SELECT is_admin FROM profiles WHERE id = auth.uid())
  );

-- 자신의 등록에만 선택 추가
CREATE POLICY insert_activity_selections ON registration_activity_selections 
  FOR INSERT WITH CHECK (
    (SELECT user_id FROM registrations WHERE id = registration_id) = auth.uid()
  );
```

#### `manager_permissions` 테이블
```sql
-- 관리자만 읽기/쓰기
CREATE POLICY manage_permissions ON manager_permissions 
  FOR ALL USING (
    (SELECT is_admin FROM profiles WHERE id = auth.uid())
  ) WITH CHECK (
    (SELECT is_admin FROM profiles WHERE id = auth.uid())
  );
```

### 4.2 기존 테이블 정책 수정

#### `registrations` 테이블 - 승인 정보 읽기
```sql
-- 자신 또는 관리자만 approval_status 조회
-- 기존 정책에 추가
```

---

## 5. 페이지/컴포넌트 구현 계획

### 5.1 신규 페이지

#### 5.1.1 `/profile` - 사용자 정보 수정
- **경로**: `app/profile/page.tsx`
- **기능**:
  - 닉네임 수정
  - 비번 변경 (Supabase Auth 사용)
  - 프로필 이미지 (선택사항)
- **권한**: 로그인 사용자만

#### 5.1.2 `/t/[id]/status` - 내 참가 현황
- **경로**: `app/t/[id]/status/page.tsx`
- **기능**:
  - 승인 상태 표시 (pending/approved/rejected)
  - 본대회 참가 상태 (applied/confirmed/waitlisted/canceled)
  - 라운드 참가 현황
  - 선택한 활동 목록
- **권한**: 로그인 사용자 (자신의 정보만)

#### 5.1.3 `/t/[id]/register/edit` - 참가 신청 수정
- **경로**: `app/t/[id]/register/edit/page.tsx`
- **기능**:
  - 기존 식사/카풀 정보 수정
  - 활동 선택 변경
  - 자신의 신청만 (canceled 제외)
- **권한**: 본인 또는 관리자

#### 5.1.4 `/admin/tournaments/[id]/dashboard` - 참가 현황 대시보드
- **경로**: `app/admin/tournaments/[id]/dashboard/page.tsx`
- **기능**:
  - 전체 통계 (신청/승인/거절)
  - 승인 대기 카운트 (배지 표시)
  - 승인 목록 (pending 상태만)
  - 개별/일괄 승인 버튼
  - 기본 정보 테이블 (닉네임, 이메일, 상태)
- **권한**: 관리자만

#### 5.1.5 `/admin/tournaments/[id]/manager-setup` - 라운드 관리자 권한
- **경로**: `app/admin/tournaments/[id]/manager-setup/page.tsx`
- **기능**:
  - 현재 관리자 목록
  - 사용자 검색 및 권한 부여
  - 권한 취소
- **권한**: 관리자만

### 5.2 기존 페이지 수정

#### 5.2.1 `/t/[id]` - 참가 신청 페이지
**현재 문제**: 저장 버튼 비활성화, 재신청 불가  
**수정 사항**:
- 저장 버튼 활성화 로직 수정
- 활동 선택 UI 추가 (최대 3개)
- 라운드별 식사/숙박 선택 UI 추가
- 재신청 로직: canceled 상태에서만 재신청 가능

#### 5.2.2 `/admin` - Admin 홈
**수정 사항**:
- 승인 대기 카운트 배지 추가
- 대시보드 링크 추가

#### 5.2.3 `/admin/tournaments/[id]/registrations` - 참가 현황 관리
**수정 사항**:
- 승인 상태 필터 추가
- 승인/거절 버튼 추가
- 기존 상태 변경 기능 유지

#### 5.2.4 `/admin/tournaments/[id]/side-events` - 라운드 관리
**수정 사항**:
- 식사 메뉴 선택 드롭다운 추가
- 숙박 가능/필수 토글 추가
- 관리자/라운드 관리자 모두 접근 가능

---

## 6. 핵심 기능별 상세 구현

### 6.1 가입 승인 프로세스

#### 플로우
```
1. 사용자 가입
   ↓
2. auth.users 생성 + profile 자동생성
   ↓
3. 사용자가 토너먼트 참가 신청
   ↓
4. registrations INSERT with approval_status = 'pending'
   ↓
5. 관리자가 승인/거절 결정
   ↓
6. approval_status = 'approved' + approved_at + approved_by 업데이트
   ↓
7. 사용자는 approved 상태에서만 본대회 status 변경 가능
```

#### 권한 타입
- **승인 프로세스**: 관리자만 (is_admin = true)
- **in-app 확인**: Admin 대시보드 배지 + 상태 필터

### 6.2 사용자 정보 수정

#### `/profile` 페이지
```typescript
// 수정 가능 정보
- nickname (profiles.nickname)
- password (auth.users.password)
- profile_image (선택사항, 향후)

// 읽기 전용
- email (auth.users.email)
- created_at
```

**실제 구현**:
- useAuth() hook으로 현재 사용자 조회
- Supabase client로 profiles 업데이트
- `supabase.auth.updateUser({ password: newPassword })` 사용

### 6.3 참가 현황 분리

#### 사용자용 `/t/[id]/status`
```
내 신청 현황
├─ 승인 상태: [pending / rejected / approved]
├─ 본대회 상태: [applied / confirmed / waitlisted / canceled]
├─ 식사 선택: [meal_option.menu_name]
└─ 참여 활동: [activity1, activity2, ...]
```

#### 관리자용 `/admin/tournaments/[id]/dashboard`
```
전체 현황 (통계)
├─ 총 신청자: N명
├─ 승인 대기: M명 [배지]
├─ 승인 완료: K명
└─ 거절: J명

승인 대기 목록 (테이블)
├─ 닉네임
├─ 이메일
├─ 신청일시
└─ [승인] [거절] 버튼
```

### 6.4 활동 선택 시스템

#### 관리자 설정 흐름
```
대회 생성
  ↓
활동 추가: /admin/tournaments/[id]/new-page
  - "오후라운드" (활동1)
  - "와인바우 저녁" (활동2)
  - "골프존 영상분석" (활동3)
  (최대 3개)
  ↓
활동별 display_order 설정
```

#### 사용자 선택 흐름
```
/t/[id] 참가신청
  ↓
활동 선택 UI (체크박스)
  - [X] 오후라운드
  - [ ] 와인바우 저녁
  - [X] 골프존 영상분석
  ↓
신청 저장
  → registration_activity_selections 에 선택 기록
```

### 6.5 라운드 관리자 권한

#### 권한 구조
```
- is_admin = true: 모든 대회의 라운드 관리 가능
- is_admin = false + manager_permissions.tournament_id=X: X 대회만 라운드 관리 가능
```

#### 관리자가 권한 부여
```
/admin/tournaments/[id]/manager-setup
  ├─ 현재 관리자 목록 (is_admin=true)
  └─ 라운드 관리자 목록 (manager_permissions 조회)
     ├─ 사용자 검색
     ├─ [권한 부여] 버튼
     └─ [권한 취소] 버튼
```

---

## 7. 구현 순서 및 단계

### 7.1 Phase 4-1: 기초 데이터베이스 (우선순위: 높음)

1. **Migration 파일 작성**
   - `db/migrations/009_approval_and_extras_system.sql`
   - 3개 신규 테이블 생성
   - 4개 기존 테이블 컬럼 추가
   - RLS policies 적용

2. **테스트**
   - Supabase에서 SQL 실행
   - 데이터 조회 확인

### 7.2 Phase 4-2: 참가 신청 버그 수정 (우선순위: 최고)

1. **현재 버그 분석**
   - `app/t/[id]/page.tsx` 검토
   - 저장 버튼 비활성화 이유 파악
   - 재신청 로직 검토

2. **수정 구현**
   - 저장 버튼 활성화 조건 수정
   - 재신청 가능 로직 추가

### 7.3 Phase 4-3: 관리자 가입 승인 (우선순위: 높음)

1. **Admin 대시보드 페이지**
   - `/admin/tournaments/[id]/dashboard` 신규 작성
   - 통계 표시 (pending 카운트)
   - 승인 테이블 (pending 상태 목록)

2. **승인/거절 기능**
   - Server Action 추가 (또는 직접 Supabase 호출)
   - approval_status 업데이트
   - approved_at, approved_by 기록

3. **Admin 홈 수정**
   - 대시보드 링크 추가
   - 승인 대기 배지 표시

### 7.4 Phase 4-4: 사용자 정보 수정 (우선순위: 높음)

1. **`/profile` 페이지**
   - Nickname 수정 form
   - Password 변경 form (Supabase Auth 사용)
   - 저장/취소 버튼

2. **권한 검증**
   - useAuth() 확인
   - 자신의 정보만 수정 가능

### 7.5 Phase 4-5: 참가 현황 분리 (우선순위: 높음)

1. **`/t/[id]/status` 페이지**
   - 자신의 신청 현황 조회
   - 승인 상태 표시
   - 라운드/활동 현황

2. **`/admin/tournaments/[id]/dashboard` 개선**
   - 기존 registrations 페이지와 구분
   - 추가: 활동 선택 조회 데이터 추가

### 7.6 Phase 4-6: 활동 선택 시스템 (우선순위: 중간)

1. **관리자 기능**
   - 활동 추가/삭제/순서 변경
   - `/admin/tournaments/[id]/extras` 신규 페이지

2. **사용자 UI**
   - `/t/[id]` 페이지에 활동 선택 UI 추가
   - 저장 시 `registration_activity_selections` 기록

3. **조회**
   - 관리 페이지에서 활동별 신청 현황 조회

### 7.7 Phase 4-7: 라운드 관리자 권한 (우선순위: 중간)

1. **권한 관리 페이지**
   - `/admin/tournaments/[id]/manager-setup`
   - 사용자 검색 + 권한 부여/취소

2. **라운드 페이지 수정**
   - `/admin/tournaments/[id]/side-events`
   - 관리자 OR 라운드 관리자 접근 가능

3. **RLS 정책 수정**
   - manager_permissions 확인하는 정책 추가

### 7.8 Phase 4-8: 라운드 추가 정보 (우선순위: 중간)

1. **라운드 생성/수정 UI**
   - 식사 메뉴 선택 드롭다운
   - 숙박 가능/필수 토글

2. **사용자 선택 UI**
   - `/t/[id]` 라운드 섹션
   - 라운드별 식사/숙박 선택

---

## 8. 각 단계의 상세 체크리스트

### 8.1 Phase 4-1 체크리스트

- [ ] Migration 파일 생성 (`009_approval_and_extras_system.sql`)
  - [ ] `tournament_extras` 테이블
  - [ ] `registration_activity_selections` 테이블
  - [ ] `manager_permissions` 테이블
  - [ ] `registrations.approval_status` 컬럼
  - [ ] `registrations.approved_at` 컬럼
  - [ ] `registrations.approved_by` 컬럼
  - [ ] `side_events.meal_option_id` 컬럼
  - [ ] `side_events.lodging_available` 컬럼
  - [ ] `side_events.lodging_required` 컬럼
  - [ ] `side_event_registrations.meal_selected` 컬럼
  - [ ] `side_event_registrations.lodging_selected` 컬럼
  - [ ] 모든 RLS policies
- [ ] Supabase에서 SQL 실행 (또는 migration 도구)
- [ ] 테이블 생성 확인

### 8.2 Phase 4-2 체크리스트

- [ ] `app/t/[id]/page.tsx` 분석
  - [ ] 저장 버튼 비활성화 이유 파악
  - [ ] 폼 유효성 검사 로직 확인
- [ ] 버그 수정
  - [ ] 저장 버튼 활성화 조건 수정
  - [ ] 테스트 (수정된 값 저장 확인)
- [ ] 재신청 로직
  - [ ] canceled 상태에서만 다시 신청 가능
  - [ ] 기존 데이터 처리 (UPDATE vs DELETE+INSERT)

### 8.3 Phase 4-3 체크리스트

- [ ] `/admin/tournaments/[id]/dashboard` 신규 페이지
  - [ ] 컴포넌트 기본 구조
  - [ ] queried 데이터: pending 카운트 + 전체 통계
  - [ ] 승인 대기 목록 (테이블)
  - [ ] [승인], [거절] 버튼
- [ ] 승인 기능 (Server Action 또는 직접 쿼리)
  - [ ] approval_status = 'approved' UPDATE
  - [ ] approved_at, approved_by 기록
  - [ ] 에러 처리
- [ ] `/admin` 홈 수정
  - [ ] 대시보드 링크 추가
  - [ ] 배지 (pending 카운트) 추가

### 8.4 Phase 4-4 체크리스트

- [ ] `/profile` 신규 페이지
  - [ ] useAuth() hook 사용 확인
  - [ ] 닉네임 input + 저장 버튼
  - [ ] 비번 변경 form (현재 비번 + 새 비번 + 확인)
  - [ ] 저장 로직
    - [ ] `supabase.from('profiles').update({nickname: ...})`
    - [ ] `supabase.auth.updateUser({password: ...})`
  - [ ] 에러 처리 및 성공 메시지
- [ ] 테스트
  - [ ] 닉네임 수정 확인
  - [ ] 비번 변경 후 로그인 확인

### 8.5 Phase 4-5 체크리스트

- [ ] `/t/[id]/status` 신규 페이지
  - [ ] 본인 신청 정보만 조회
  - [ ] approval_status 표시
  - [ ] registrations.status 표시
  - [ ] 식사 선택 표시
  - [ ] 라운드 참가 목록
  - [ ] 활동 선택 목록
- [ ] 대시보드 개선 (향후)
  - [ ] 활동별 선택 현황

### 8.6 Phase 4-6 체크리스트

- [ ] `/admin/tournaments/[id]/extras` 페이지
  - [ ] 활동 추가 form
  - [ ] 활동 목록 (display_order로 정렬)
  - [ ] 삭제 버튼
  - [ ] 순서 변경 (up/down 버튼)
- [ ] `/t/[id]` 수정
  - [ ] 활동 선택 UI (체크박스들)
  - [ ] 저장 시 `registration_activity_selections` 기록
- [ ] 관리 페이지 개선 (향후)
  - [ ] 활동별 신청자 필터링

### 8.7 Phase 4-7 체크리스트

- [ ] `/admin/tournaments/[id]/manager-setup` 페이지
  - [ ] 현재 관리자 목록 (is_admin=true인 사용자들)
  - [ ] 라운드 관리자 목록 (manager_permissions 쿼리)
  - [ ] 사용자 검색 input
  - [ ] [권한 부여], [권한 취소] 버튼
  - [ ] 권한 부여 로직 (INSERT manager_permissions)
  - [ ] 에러 처리 (이미 부여된 권한 중복 방지)
- [ ] `/admin/tournaments/[id]/side-events` 수정
  - [ ] 관리자 또는 라운드 관리자 접근 체크
  - [ ] RLS 정책 확인

### 8.8 Phase 4-8 체크리스트

- [ ] `/admin/tournaments/[id]/side-events` 수정
  - [ ] meal_option_id SELECT 드롭다운
  - [ ] lodging_available, lodging_required 토글
  - [ ] 저장 로직
- [ ] `/t/[id]` 라운드 섹션 수정
  - [ ] 라운드별 식사 표시
  - [ ] 식사 선택 UI (라운드별)
  - [ ] 숙박 선택 UI (라운드별)
  - [ ] 저장 로직
- [ ] 테스트
  - [ ] 라운드 생성 시 식사/숙박 설정 확인
  - [ ] 사용자의 선택 저장 확인

---

## 9. 데이터 마이그레이션 전략

### 9.1 기존 데이터 처리

현재 없는 필드들 (approval_status 등)은 default 값으로 설정:

```sql
-- 신규 컬럼 추가 시 기본값
approval_status DEFAULT 'approved'  -- 기존 사용자는 자동 승인
approved_at DEFAULT NOW()
approved_by DEFAULT (SELECT id FROM auth.users WHERE email = 'admin@example.com') -- 또는 NULL

meal_option_id DEFAULT NULL
lodging_available DEFAULT FALSE
lodging_required DEFAULT FALSE
```

### 9.2 점진적 도입

1. Migration 후 새 신청부터 approval_status = 'pending'
2. 기존 신청자는 'approved' 상태로 유지
3. 다음 대회부터 새로운 승인 프로세스 적용

---

## 10. API / Server Actions 설계

### 10.1 필요한 Server Actions

```typescript
// app/actions/approval.ts
export async function approveRegistration(
  registrationId: bigint,
  approverId: string
): Promise<{ success: boolean; error?: string }>;

export async function rejectRegistration(
  registrationId: bigint,
  reason?: string
): Promise<{ success: boolean; error?: string }>;

// app/actions/profile.ts
export async function updateNickname(nickname: string): Promise<{ success: boolean; error?: string }>;

export async function changePassword(
  currentPassword: string,
  newPassword: string
): Promise<{ success: boolean; error?: string }>;

// app/actions/registration.ts
export async function updateRegistrationExtras(
  registrationId: bigint,
  data: { mealOptionId?: bigint; activities?: bigint[] }
): Promise<{ success: boolean; error?: string }>;

// app/actions/manager.ts
export async function grantManagerPermission(
  userId: string,
  tournamentId: bigint
): Promise<{ success: boolean; error?: string }>;

export async function revokeManagerPermission(
  userId: string,
  tournamentId: bigint
): Promise<{ success: boolean; error?: string }>;
```

### 10.2 Server Actions vs Direct Supabase Client

- **승인/거절**: Server Action (민감한 작업)
- **정보 조회**: 직접 클라이언트 쿼리 (읽기 권한 확인은 RLS에서)
- **사용자 정보 수정**: Server Action (비번 변경 등)
- **권한 관리**: Server Action (관리자 전용)

---

## 11. 테스트 전략

### 11.1 단위 테스트 (향후)

- Server Actions 테스트
- RLS 정책 테스트

### 11.2 수동 테스트

#### 시나리오 1: 승인 프로세스
```
1. 신규 사용자 가입
2. 토너먼트 참가 신청 → approval_status = 'pending'
3. 관리자가 대시보드에서 [승인] 클릭
4. approval_status = 'approved'
5. 사용자가 /t/[id]/status 에서 "승인됨" 확인
```

#### 시나리오 2: 정보 수정
```
1. 사용자가 /profile 방문
2. 닉네임 변경 + 저장
3. 모든 페이지에서 새 닉네임 표시 확인
4. 비번 변경 + 로그아웃
5. 새 비번으로 로그인 성공
```

#### 시나리오 3: 참가 신청 버그
```
1. 사용자가 /t/[id] 에서 식사 선택 + 활동 선택
2. [저장] 버튼 활성화된 상태
3. 저장 클릭 → 성공 메시지
4. 페이지 새로고침 → 선택된 값 표시
```

#### 시나리오 4: 활동 선택
```
1. 관리자가 /admin/tournaments/[id]/extras 에서 3개 활동 추가
2. 사용자가 /t/[id] 에서 활동 선택
3. /t/[id]/status 에서 선택된 활동 확인
4. 관리자 페이지에서 활동별 선택 현황 조회
```

#### 시나리오 5: 라운드 관리자 권한
```
1. 관리자가 일반 사용자 A를 라운드 관리자로 지정
2. A가 /admin/tournaments/[id]/side-events 접근 가능
3. A가 다른 대회의 라운드는 관리 불가
4. 권한 취소 후 접근 불가
```

---

## 12. 구현 중 주의사항

### 12.1 데이터 무결성

- `approved_by` NOT NULL 가능성: 관리자가 승인하면 자동 설정
- 중복 승인 방지: approval_status 확인 후 업데이트
- 활동 삭제 시: `registration_activity_selections` 함께 삭제

### 12.2 권한 검증

- 모든 업데이트 작업에서 admin 또는 self 체크
- RLS 정책으로 1차 방어
- Server Action에서 2차 검증

### 12.3 에러 처리

- 사용자 친화적 메시지 표시
- 콘솔에 상세 로그
- 비탈출식 폼 검증

### 12.4 성능

- 대시보드의 pending 카운트: indexed column 사용
- 활동 테이블: display_order 기본 정렬
- 대량 승인: 배치 처리 고려 (향후)

---

## 13. 최종 체크리스트

### 기본 완료 항목
- [ ] 요구사항 7개 모두 이해
- [ ] 데이터베이스 스키마 설계 완료
- [ ] 페이지 구조 확정
- [ ] 우선순위 정렬 완료

### 구현 시작 전
- [ ] 작업 환경 준비 (git branch, 테스트 환경)
- [ ] Migration 파일 작성 및 테스트
- [ ] 기존 코드 벡업 또는 git commit

### 구현 진행
- [ ] Phase 4-1 완료 (DB)
- [ ] Phase 4-2 완료 (버그 수정)
- [ ] Phase 4-3 완료 (승인)
- [ ] Phase 4-4 완료 (프로필)
- [ ] Phase 4-5 완료 (현황)
- [ ] Phase 4-6 완료 (활동)
- [ ] Phase 4-7 완료 (라운드 관리자)
- [ ] Phase 4-8 완료 (라운드 추가정보)

### 최종 테스트
- [ ] 모든 시나리오 수동 테스트
- [ ] 에러 케이스 확인
- [ ] RLS 정책 동작 확인
- [ ] 프로덕션 배포 전 검토

---

## 14. 관련 참고 자료

- **기존 코드베이스 분석**: COMPREHENSIVE_CODEBASE_ANALYSIS.md
- **개발 가이드**: GolfTour_DevGuide_LoginOnly_AdminOptions_v2.md
- **요구사항**: GolfTour_Requirements_Tutorial.md
- **진행 상황**: IMPLEMENTATION_STATUS.md

---

**문서 작성자**: AI Assistant  
**마지막 업데이트**: 2026년 2월 9일  
**버전**: 1.0
