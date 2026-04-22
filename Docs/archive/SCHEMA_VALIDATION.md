# Supabase 스키마 검증 가이드

현재 프로젝트의 코드와 Supabase 데이터베이스를 비교하는 문서입니다.
**Supabase Dashboard → SQL Editor에서 아래 쿼리들을 실행하고 결과를 확인하세요.**

---

## 🔍 필수 검증 항목

### 1️⃣ profiles 테이블 (핵심 - 로그인 관련)

**현재 필요한 컬럼:**
- `id` (UUID, PK) ✅
- `nickname` (TEXT) ✅
- `full_name` (TEXT) ✅
- `is_admin` (BOOLEAN, default false) ✅
- **`is_approved` (BOOLEAN, default false) ⚠️ - 로그인에 꼭 필요!**
- **`email` (TEXT) - 선택사항 (manager search에 필요)**
- `created_at` (TIMESTAMP) ✅
- `updated_at` (TIMESTAMP) ✅

**확인 쿼리:**
```sql
-- profiles 테이블의 모든 컬럼 확인
SELECT column_name, data_type, is_nullable, column_default
FROM information_schema.columns
WHERE table_name = 'profiles'
ORDER BY ordinal_position;
```

**결과 예상:**
```
column_name    | data_type | is_nullable | column_default
id             | uuid      | NO          | NULL
nickname       | text      | NO          | NULL
full_name      | text      | YES         | NULL
is_admin       | boolean   | NO          | false
is_approved    | boolean   | NO          | false  ← 이것이 반드시 있어야 함!
email          | text      | YES         | NULL
created_at     | timestamp | NO          | now()
updated_at     | timestamp | NO          | now()
```

---

### 2️⃣ 관계 테이블들

#### tournaments
```sql
SELECT column_name, data_type
FROM information_schema.columns
WHERE table_name = 'tournaments'
ORDER BY ordinal_position;
```

**필수 컬럼:**
- id, title, location, event_date, status, created_at, updated_at

#### registrations
```sql
SELECT column_name, data_type
FROM information_schema.columns
WHERE table_name = 'registrations'
ORDER BY ordinal_position;
```

**필수 컬럼:**
- id, tournament_id, user_id, nickname, status, memo, created_at, updated_at
- **`approval_status` (선택사항 - 승인 시스템)**
- **`approved_at`, `approved_by` (선택사항)**

#### side_events
```sql
SELECT column_name, data_type
FROM information_schema.columns
WHERE table_name = 'side_events'
ORDER BY ordinal_position;
```

#### side_event_registrations
```sql
SELECT column_name, data_type
FROM information_schema.columns
WHERE table_name = 'side_event_registrations'
ORDER BY ordinal_position;
```

#### registration_extras
```sql
SELECT column_name, data_type
FROM information_schema.columns
WHERE table_name = 'registration_extras'
ORDER BY ordinal_position;
```

---

### 3️⃣ Functions 확인

**필수 Function:**
```sql
-- is_approved_user 함수 존재 확인
SELECT routine_name
FROM information_schema.routines
WHERE routine_name IN ('is_admin', 'is_approved_user', 'is_admin_secure')
AND routine_type = 'FUNCTION';
```

**결과 예상:**
```
is_admin
is_admin_secure
is_approved_user
```

---

### 4️⃣ RLS 정책 확인

```sql
-- profiles 테이블의 모든 정책 확인
SELECT policyname, qual, with_check
FROM pg_policies
WHERE tablename = 'profiles';
```

**필요한 정책:**
- Users can view own profile
- Users can update own profile  
- Admins can view all profiles
- Admins can update profiles

---

## 📋 로그인 문제 진단 순서

### Step 1: profiles 테이블 구조 확인
```sql
SELECT column_name, data_type, is_nullable
FROM information_schema.columns
WHERE table_name = 'profiles'
ORDER BY column_name;
```
**⚠️ `is_approved` 컬럼이 없으면 → Migration 010 실행 필요**

### Step 2: 테스트 사용자 확인
```sql
-- Gmail로 가입한 사용자 확인
SELECT id, nickname, is_admin, is_approved, email, created_at
FROM profiles
WHERE email LIKE '%gmail.com%'
LIMIT 5;
```

### Step 3: 특정 사용자의 상세 정보
```sql
-- prodigyrcn@gmail.com 사용자 확인
SELECT * FROM profiles
WHERE email = 'prodigyrcn@gmail.com';
```

### Step 4: is_approved_user 함수 테스트
```sql
-- 함수 존재 여부 확인
SELECT public.is_approved_user('사용자UUID'::uuid);
```

---

## 🔧 마이그레이션 상태

현재 적용되어야 하는 마이그레이션:

| 파일번호 | 파일명 | 상태 | 용도 |
|---------|--------|------|------|
| 003 | side_events.sql | ✅ | 라운드 시스템 |
| 004 | enforce_authentication.sql | ✅ | 로그인 필수화 |
| 005 | meal_options.sql | ✅ | 식사 옵션 |
| 006 | registration_extras.sql | ✅ | 기타 옵션 |
| 007 | tournament_groups.sql | ✅ | 조편 시스템 |
| 008 | fix_profiles_rls.sql | ✅ | RLS 최적화 |
| 009 | approval_and_extras_system.sql | ✅ | 승인 시스템 |
| 010 | account_approval.sql | **⚠️ 필수** | `is_approved` 컬럼 추가 |
| 011 | multi_participant_and_undecided.sql | ✅ | 다중 참가자 |
| 012 | profiles_email.sql | ✅ | 이메일 동기화 |
| 013 | feedback_board.sql | ✅ | 피드백 시스템 |

---

## 🚨 현재 로그인 문제 원인으로 의심되는 것 들

### ❌ 가능성 1: `is_approved` 컬럼 부재
- **현상:** 형제 SQL 쿼리에서 컬럼을 찾을 수 없음
- **해결:** Migration 010 실행
- **확인 쿼리:**
```sql
SELECT column_name FROM information_schema.columns
WHERE table_name = 'profiles' AND column_name = 'is_approved';
```

### ❌ 가능성 2: `is_approved_user` 함수 부재
- **현상:** Middleware에서 함수 호출 실패
- **해결:** Migration 010 실행
- **확인 쿼리:**
```sql
SELECT EXISTS (
  SELECT 1 FROM information_schema.routines
  WHERE routine_name = 'is_approved_user'
);
```

### ❌ 가능성 3: RLS 정책 문제
- **현상:** 조회는 되는데 permission denied
- **해결:** 010의 RLS 정책 확인
- **확인 쿼리:**
```sql
SELECT policyname FROM pg_policies
WHERE tablename = 'profiles' AND policyname LIKE '%approved%';
```

### ❌ 가능성 4: 특정 사용자의 `is_approved = false`
- **현상:** 첫 로그인 후, 관리자 승인 안 됨
- **해결:** 관리자 승인 필요
- **확인 쿼리:**
```sql
UPDATE profiles
SET is_approved = true
WHERE email = '테스트 이메일'
RETURNING id, nickname, is_approved;
```

---

## ✅ 검증 완료 체크리스트

- [ ] profiles 테이블에 `is_approved` 컬럼 있음
- [ ] profiles 테이블에 `email` 컬럼 있음
- [ ] `is_approved_user()` 함수 존재
- [ ] `is_admin_secure()` 함수 존재
- [ ] 모든 tables에 RLS 활성화됨
- [ ] 현재 테스트 사용자의 `is_approved = true`
- [ ] Middleware에서 함수 호출 성공
- [ ] 로그인 시도 후 /start로 리다이렉트됨

---

## 📝 제출해야 할 정보

아래 쿼리 결과를 모두 제출해주세요:

```sql
-- 1. profiles 테이블 구조
SELECT column_name, data_type, is_nullable, column_default
FROM information_schema.columns
WHERE table_name = 'profiles'
ORDER BY ordinal_position;

-- 2. 함수 목록
SELECT routine_name
FROM information_schema.routines
WHERE routine_type = 'FUNCTION'
AND routine_name IN ('is_admin', 'is_admin_secure', 'is_approved_user')
ORDER BY routine_name;

-- 3. 테스트 사용자 상태
SELECT id, nickname, is_admin, is_approved, email, created_at
FROM profiles
LIMIT 10;
```

이 결과를 보면 **현재 상황을 정확히 파악**할 수 있습니다.
