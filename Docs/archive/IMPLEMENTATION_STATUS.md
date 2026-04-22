# Golf Tour 구현 현황 정리

**최종 업데이트**: 2026-02-09  
**완료 단계**: Phase 1 + Phase 2 + Phase 3 ✅

---

## 📋 구현된 페이지 & 기능

### 👥 공개 페이지 (로그인 불필요)

#### 1. **`/` - 대회 목록**
- 모든 대회 조회 (공개)
- 상태 배지 (draft/open/closed/done)
- 각 대회로 이동 가능

#### 2. **`/t/[id]` - 대회 상세 (Phase 1 완성 + Phase 3 확장)**
**구성:**
- **대회 정보 카드**
  - 제목, 일정, 코스, 위치, 상태
  
- **참가 신청 섹션**
  - 로그인한 사용자만 신청 가능
  - 닉네임 입력 (프로필 기본값 사용 가능)
  - 메모 추가 가능
  - 신청/취소 버튼
  
- **참가 현황 (공개)**
  - 닉네임 + 상태만 공개
  - 개인정보 미노출
  
- **첨부파일**
  - 공개 파일 목록 (groups, notice, other)
  - 직접 다운로드 링크
  
- **사전/사후 라운드 (Phase 3 신규)**
  - 각 라운드별로 제목, 시간, 위치, 최대 인원, 상태 표시
  - 라운드별 신청/취소
  - 라운드별 신청 현황 (공개)

#### 3. **`/login` - 로그인/회원가입**
- Supabase Auth 통합
- 이메일 회원가입
- 프로필 자동 생성

---

### 👨‍💼 관리자 페이지 (로그인 + is_admin 필수)

#### 1. **`/admin` - 대시보드**
- 관리자 메인 페이지
- 대회/신청/파일 관리 네비게이션

#### 2. **`/admin/tournaments` - 대회 목록**
- 모든 대회 조회
- 각 대회별 작업 버튼:
  - **수정** → `/admin/tournaments/[id]/edit`
  - **신청자 관리** → `/admin/tournaments/[id]/registrations`
  - **파일 관리** → `/admin/tournaments/[id]/files`
  - **라운드 관리** → `/admin/tournaments/[id]/side-events` (Phase 3 신규)
  - **공개 페이지** → `/t/[id]`

#### 3. **`/admin/tournaments/new` - 대회 생성**
- 제목, 일정, 코스, 위치, Tee Time, 설명
- 신청 시간 범위 설정 (open_at, close_at)
- 상태 설정 (draft/open/closed/done)
- 생성/복제 기능 (지난달 대회 복제 가능)

#### 4. **`/admin/tournaments/[id]/edit` - 대회 수정**
- 모든 필드 수정 가능
- 상태 변경 (draft → open → closed → done)

#### 5. **`/admin/tournaments/[id]/registrations` - 신청자 관리**
- 모든 신청자 목록 (닉네임, 상태)
- 상태 변경 버튼:
  - applied → confirmed (확정)
  - applied → waitlisted (대기)
  - → canceled (취소)
- 감사 로그 기록

#### 6. **`/admin/tournaments/[id]/files` - 파일 관리**
- 파일 업로드 (tournament-files 버킷)
- 파일 유형 설정 (groups/notice/other)
- 공개 여부 설정 (is_public)
- 파일 삭제

#### 7. **`/admin/tournaments/[id]/side-events` - 라운드 관리 (Phase 3 신규)**
- 라운드 생성/수정/삭제
- 라운드별 정보:
  - 유형 (사전/사후)
  - 제목, Tee Time, 위치, 설명
  - 최대 인원, 상태
  - 신청 시간 범위 (open_at, close_at)
- 각 라운드 신청자 관리
- 첫 번째 라운드 신청자만 상태 변경 가능

---

## 📊 DB 스키마 (테이블)

### 1. **profiles** (사용자 프로필)
```
id (uuid) | nickname (text) | full_name (text) | is_admin (boolean) | created_at | updated_at
```
- Auth 사용자 생성 시 자동 생성 (trigger)

### 2. **tournaments** (대회)
```
id | title | course_name | location | event_date | tee_time | notes
open_at | close_at | status (draft/open/closed/done) | created_by | created_at | updated_at
```

### 3. **registrations** (대회 신청)
```
id | tournament_id | user_id | nickname | status (applied/confirmed/waitlisted/canceled)
memo | created_at | updated_at | unique(tournament_id, user_id)
```

### 4. **tournament_files** (대회 파일)
```
id | tournament_id | file_type (groups/notice/other) | file_name
storage_path | is_public (boolean) | uploaded_by | created_at
```

### 5. **side_events** (라운드) - Phase 3
```
id | tournament_id | round_type (pre/post) | title | tee_time | location
notes | max_participants | status (draft/open/closed/done)
open_at | close_at | created_by | created_at | updated_at
```

### 6. **side_event_registrations** (라운드 신청) - Phase 3
```
id | side_event_id | user_id | nickname | status (applied/confirmed/waitlisted/canceled)
memo | created_at | updated_at | unique(side_event_id, user_id)
```

### 7. **audit_logs** (감사 로그)
```
id | entity_type (registration/side_event_registration) | entity_id
action (insert/update/delete) | actor_id | before (jsonb) | after (jsonb) | created_at
```

---

## 🔐 RLS (Row Level Security) & 권한

### 공개 조회 (누구나)
- ✅ tournaments (대회 목록)
- ✅ registrations (신청 현황 - 닉네임/상태만 포함)
- ✅ tournament_files (공개 파일만)
- ✅ side_events (라운드 목록)
- ✅ side_event_registrations (라운드 신청 현황)

### 로그인 사용자 (자신 것만)
- ✅ registrations (자신의 신청만 insert/update)
- ✅ side_event_registrations (자신의 라운드 신청만 insert/update)

### 관리자 (모든 권한)
- ✅ tournaments (CRUD)
- ✅ registrations (모든 업데이트)
- ✅ tournament_files (CRUD)
- ✅ side_events (CRUD)
- ✅ side_event_registrations (모든 업데이트)
- ✅ audit_logs (조회만)

---

## 📈 User Flow

### 일반 사용자
```
1. / (대회 목록 조회)
   ↓
2. /login (로그인)
   ↓
3. /t/[id] (대회 상세)
   ├─ 신청/취소
   ├─ 라운드 신청/취소
   └─ 파일 다운로드
```

### 관리자
```
1. /login (로그인)
   ↓
2. /admin (관리자 대시보드)
   ↓
3. /admin/tournaments (대회 목록)
   ├─ /admin/tournaments/new (새 대회 생성)
   ├─ /admin/tournaments/[id]/edit (대회 수정)
   ├─ /admin/tournaments/[id]/registrations (신청자 관리)
   ├─ /admin/tournaments/[id]/files (파일 관리)
   └─ /admin/tournaments/[id]/side-events (라운드 관리)
       ├─ 라운드 생성/수정/삭제
       └─ 라운드 신청자 상태 변경
```

---

## 🧪 테스트 계정

| 계정 | 이메일 | 비밀번호 | 권한 |
|------|--------|---------|------|
| 관리자1 | admin@test.com | TestAdmin123! | 관리자 |
| 사용자1 | user1@test.com | TestUser123! | 일반 |
| 사용자2 | user2@test.com | TestUser123! | 일반 |

---

## 📝 주요 기능 체크리스트

### Phase 1 (대회 목록/상세 + 공개 현황) ✅
- [x] 대회 목록 공개 조회
- [x] 대회 상세 공개 조회
- [x] 신청 현황 공개 (닉네임+상태만)
- [x] 로그인한 사용자 신청/취소
- [x] 중복 신청 방지
- [x] 개인정보 미노출

### Phase 2 (관리자 기능) ✅
- [x] 관리자 권한 가드
- [x] 대회 CRUD (생성/수정/복제)
- [x] 신청 상태 변경 (applied/confirmed/waitlisted/canceled)
- [x] 파일 업로드 (Public Storage)
- [x] Storage 공개 링크 제공

### Phase 3 (사전/사후 라운드) ✅
- [x] side_events DB 구성
- [x] side_event_registrations DB 구성
- [x] 라운드 생성/수정/삭제 (관리자)
- [x] 라운드 신청/취소 (사용자)
- [x] 라운드 신청 현황 공개
- [x] 라운드 상태 관리 (관리자)
- [x] 감사 로그 기록

### Phase 4 (향후) ⏳
- [ ] Storage Private 전환
- [ ] Signed URL 발급 로직
- [ ] Edge Function (알림)
- [ ] 운영 리포트

---

## 🚀 가동 준비 체크

- [x] 계정 생성 (관리자+사용자)
- [x] DB 마이그레이션 (Phase 1, 2, 3)
- [x] RLS 정책 설정
- [x] 공개 페이지 구현
- [x] 관리자 페이지 구현
- [x] 감사 로그 시스템
- [ ] UI 테스트 (웹브라우저)
- [ ] 배포 전 점검
