# 달콧 별장 예약 시스템 — 종합 설계서 v2.0

> 작성일: 2026-03-09  
> 브랜치: `feature-dalkkot`  
> 기반 분석: DALKKOT_INTEGRATION_ANALYSIS.md  
> 참조: `RefRepo/Dalkkot_System_Design.md`, `RefRepo/dalkkot-main/`, 구글 시트 원본  
> 구현 목표: `app/jeju/` 완성

---

## 1. 프로젝트 최종 목표

구글 시트로 운영되던 **달콧 별장 예약 시스템**을 JustGolf 웹서비스(Next.js + Supabase + Vercel)에 완전 통합.  
기존 구글 시트의 **모든 탭(이용내역·이용방법·26년예약일정·맛집리스트)**을 웹 데이터로 마이그레이션하며,  
UI/UX는 `dalkkot-main` 프로토타입 (우드+크림+세이지 디자인)을 최대한 유지한다.

---

## 2. 페이지 구성 (5개 섹션)

### 2-1. 전체 라우트 구조

```
/jeju                           ← 달콧 홈 (소개 + 공유 캘린더 요약)
/jeju/calendar                  ← 예약 캘린더 + 신청 (로그인 필수)
/jeju/info                      ← 이용 수칙 / 별장 소개 (이용방법 탭 대체)
/jeju/restaurants               ← 맛집 리스트 (맛집리스트 탭 대체)
/jeju/admin                     ← 달콧 관리자 패널 (is_dalkkot_admin 전용)
```

### 2-2. 각 페이지 설명

#### `/jeju` — 달콧 홈
- **Hero 배너**: 별장 소개 + 제주 감성 이미지
- **미니 캘린더**: 이번 달 예약 현황 한눈에 보기 (로그인 시만 예약자 닉네임 표시)
- **통계 카드**: 이번 달 예약 건수 / 확정 건수 / 빈 날짜 수
- **내 예약 현황 카드** (로그인 시): 예약 상태 배지 + 빠른 진입
- **바로가기 버튼**: 예약 신청 / 이용 수칙 / 맛집 리스트

#### `/jeju/calendar` — 예약 캘린더
> **로그인 필수** — 비로그인 접근 시 로그인 페이지 리다이렉트

- **월별 캘린더 전체 뷰**: 예약자 닉네임 + 색상 블록 표시
- **날짜 클릭** → 예약 신청 모달 (빈 날짜만, 이미 예약된 날짜 클릭 불가)
- **내 예약 목록**: 예약 상태 표시 (대기/입금대기/확정/취소)
- **예약 상세 모달**: 클릭 시 상세 정보 (본인 예약은 취소 버튼 포함)

#### `/jeju/info` — 이용 수칙 / 소개
> 로그인 사용자만 열람 (민감 정보 포함)

- **별장 소개**: 위치/교통/주차 정보
- **이용 수칙**: 공과금/셀프청소/보일러/쓰레기 처리 등
- **예약 신청 안내**: 입금 계좌 정보 / 정산 방식 안내
- **FAQ**: 자주 묻는 사항 (커피 캡슐 등)
- 관리자가 내용을 수정할 수 있는 CMS 구조 (`villa_info` 테이블)

#### `/jeju/restaurants` — 맛집 리스트
> 로그인 사용자 열람, 관리자 추가/편집 가능

- **카드형 리스트**: 가게명 / 카테고리 / 주소 / 메모 / 추천 메뉴
- **카테고리 필터**: 식당 / 카페 / 카페 / 편의점 등
- **지도 링크**: 각 가게 카카오맵/네이버지도 링크 연결
- 관리자가 나중에 항목 추가/편집 가능

#### `/jeju/admin` — 달콧 관리자 패널
> `is_dalkkot_admin = true` 전용

- **신청 목록**: 대기/입금 대기 중인 예약 신청 목록
  - 예약자 닉네임 + **실명/전화번호** 확인 가능
  - [입금요청] → 상태 `waiting_deposit` 으로 변경
  - [입금확인·최종확정] → 상태 `confirmed` 으로 변경
  - [반려] 버튼
- **확정 목록**: 확정된 예약 전체 목록
- **공과금 검침값 입력**: 퇴실 완료 건에 가스/수도/전기 검침값 기록 + 자동 차액 계산
- **이용수칙 편집** (CMS): `/jeju/info` 내용 수정 가능
- **맛집 등록**: `/jeju/restaurants` 항목 추가/편집

---

## 3. 사용자 시스템 설계

### 3-1. 기존 프로젝트 프로필 구조 활용

```sql
-- 기존 테이블 (변경 없음)
public.profiles (
  id uuid PK,
  nickname text,       -- ← 캘린더 공개 표시용 닉네임 (예: 빠빠라찌)
  full_name text,      -- 실명 (회원가입 시 수집)
  is_admin boolean,    -- 기존 골프 관리자 플래그
  -- 추가 필요:
  is_dalkkot_admin boolean DEFAULT false  -- 달콧 전용 관리자
)
```

**⚠️ `is_admin`과 `is_dalkkot_admin` 분리 이유**: 골프 대회 관리자와 달콧 별장 관리자는 다른 사람일 수 있음. 또한 달콧 관련 기능은 독립적으로 권한 관리되어야 함.

### 3-2. 예약 시 정보 흐름

```
로그인 사용자가 예약 신청 시:
┌─────────────────────────────────────────────────┐
│  자동 채워짐 (수정 불가)                          │
│  - 닉네임: profiles.nickname                    │
│  - 캘린더 표시 색상: 자동 할당                   │
│                                                 │
│  추가 입력 (예약별 수집)                         │
│  - 실명 (real_name)       ← 관리자만 열람        │
│  - 전화번호 (phone)        ← 관리자만 열람        │
│  - 체크인/체크아웃 날짜                           │
│  - 예약 인원 (guests, 선택)                     │
│  - 요청/비고 (notes, 선택)                      │
│  - 이용 수칙 동의 체크박스 (필수)                │
└─────────────────────────────────────────────────┘
```

---

## 4. 예약 상태 흐름 (Payment Flow 포함)

### 4-1. 상태 정의

```
pending          → 신청 완료, 관리자 검토 대기
waiting_deposit  → 관리자가 입금 요청 (연락 완료)
confirmed        → 입금 확인, 최종 예약 확정
rejected         → 반려 (날짜 충돌, 부적절 등)
cancelled        → 신청자 본인 취소 (pending/waiting_deposit 상태만 가능)
```

### 4-2. 상태 전환 다이어그램

```
[사용자 신청]
     ↓
  pending
  (신청완료)
     ↓                    ↘
[관리자 입금요청]      [관리자 반려]
     ↓                         ↓
waiting_deposit            rejected
(입금대기)           
     ↓               ↘
[관리자 입금확인]   [사용자 취소]
     ↓                    ↓
  confirmed            cancelled
  (최종확정)
```

### 4-3. 캘린더 표시 방식

| 상태 | 캘린더 블록 표시 | 날짜 선택 가능 여부 |
|------|----------------|-------------------|
| `pending` | 닉네임 + 반투명 (대기 중) | 해당 날짜 선택 불가 |
| `waiting_deposit` | 닉네임 + 주황 경계선 (입금대기) | 선택 불가 |
| `confirmed` | 닉네임 + 진한 색 (확정) | 선택 불가 |
| `rejected` | 표시 안 함 | 선택 가능 |
| `cancelled` | 표시 안 함 | 선택 가능 |

---

## 5. 데이터베이스 스키마 설계

### 5-1. profiles 테이블 수정 마이그레이션

```sql
-- db/migrations/20260309_01_profiles_dalkkot_admin.sql

ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS is_dalkkot_admin BOOLEAN NOT NULL DEFAULT false;

COMMENT ON COLUMN public.profiles.is_dalkkot_admin 
  IS '달콧 별장 전용 관리자 권한 플래그';
```

### 5-2. dalkkot_villas 테이블

```sql
-- db/migrations/20260309_02_dalkkot_villas.sql

CREATE TABLE IF NOT EXISTS public.dalkkot_villas (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name        TEXT NOT NULL DEFAULT '달콧',
  address     TEXT,                -- '제주 조천읍 조함해안로 17-7'
  description TEXT,                -- Markdown: 별장 소개
  rules       TEXT,                -- Markdown: 이용 수칙
  faq         TEXT,                -- Markdown: FAQ (커피 캡슐 등)
  is_active   BOOLEAN NOT NULL DEFAULT true,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TRIGGER trg_dalkkot_villas_updated_at
  BEFORE UPDATE ON public.dalkkot_villas
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- 초기 데이터 삽입
INSERT INTO public.dalkkot_villas (name, address, description, rules) VALUES (
  '달콧',
  '제주 조천읍 조함해안로 17-7',
  '안녕하세요 제주별장 달콧입니다.\n\n공과금 사용한만큼 후불, 셀프청소',
  '- 퇴실할 때 보일러 켜진상태로 놓아주시고 퇴실카톡 부탁드립니다\n- 대문,현관은 항상 닫힌상태로 유지해주세요\n- 화장실에 물티슈 사용불가\n- 쓰레기는 밖에 모아두었다가 버려주세요\n- 음식물쓰레기는 티머니 카드로 태그하고 버릴 수 있습니다\n- 퇴실할 때 술 외의 모든 음식물은 처리부탁드립니다\n- 안거리 보일러는 20도 난방에 맞춰 놓고 퇴실바랍니다\n- 밖거리 전기보일러는 꺼주세요\n- 숙소점검 왔다고 하면 영업하는집 아니고 동호회지인이 빌려준거라 말해주시면됩니다\n- 창고안 세탁기의 멀티탭은 항상켜놔 주세요'
);
```

### 5-3. dalkkot_reservations 테이블

```sql
-- db/migrations/20260309_03_dalkkot_reservations.sql

CREATE TABLE IF NOT EXISTS public.dalkkot_reservations (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  villa_id        UUID NOT NULL REFERENCES public.dalkkot_villas(id) ON DELETE CASCADE,
  user_id         UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  
  -- 공개 정보 (캘린더에 표시)
  nickname        TEXT NOT NULL,             -- 예약 시점의 profiles.nickname 스냅샷
  check_in        DATE NOT NULL,
  check_out       DATE NOT NULL,
  color           TEXT NOT NULL DEFAULT '#4CAF50',  -- 캘린더 표시 색상
  
  -- 관리자 전용 정보 (RLS로 보호)
  real_name       TEXT,                      -- 실명 (예약 시 입력)
  phone           TEXT,                      -- 연락처 (예약 시 입력)
  guests          INTEGER,                   -- 예약 인원 (선택)
  notes           TEXT,                      -- 요청/비고
  
  -- 상태 관리
  status          TEXT NOT NULL DEFAULT 'pending'
                    CHECK (status IN ('pending','waiting_deposit','confirmed','rejected','cancelled')),
  
  -- 공과금 검침값 (관리자 입력, 퇴실 후)
  gas_meter_in    NUMERIC,
  gas_meter_out   NUMERIC,
  water_meter_in  NUMERIC,
  water_meter_out NUMERIC,
  elec_meter_in   NUMERIC,
  elec_meter_out  NUMERIC,
  meter_notes     TEXT,                      -- 검침 특이사항 (고장 등)
  
  -- 마이그레이션 원본 식별용
  is_migrated     BOOLEAN NOT NULL DEFAULT false,  -- 구글 시트에서 가져온 데이터 여부
  
  created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  
  CONSTRAINT chk_dates CHECK (check_out > check_in)
);

CREATE TRIGGER trg_dalkkot_reservations_updated_at
  BEFORE UPDATE ON public.dalkkot_reservations
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- 날짜 중복 방지 (rejected·cancelled 제외)
CREATE EXTENSION IF NOT EXISTS btree_gist;

ALTER TABLE public.dalkkot_reservations
  ADD CONSTRAINT no_overlap_reservations
  EXCLUDE USING gist (
    villa_id WITH =,
    daterange(check_in, check_out, '[)') WITH &&
  ) WHERE (status NOT IN ('rejected', 'cancelled'));
```

### 5-4. dalkkot_restaurants 테이블

```sql
-- db/migrations/20260309_04_dalkkot_restaurants.sql

CREATE TYPE restaurant_category AS ENUM (
  '식당', '카페', '베이커리', '술집', '편의점', '기타'
);

CREATE TABLE IF NOT EXISTS public.dalkkot_restaurants (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name        TEXT NOT NULL,
  category    restaurant_category NOT NULL DEFAULT '식당',
  address     TEXT,
  description TEXT,                -- 추천 메뉴, 특징 메모
  map_url     TEXT,                -- 카카오맵/네이버지도 링크
  added_by    UUID REFERENCES auth.users(id),
  created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TRIGGER trg_dalkkot_restaurants_updated_at
  BEFORE UPDATE ON public.dalkkot_restaurants
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- 초기 데이터 (맛집리스트 탭 데이터 수동 입력 필요)
-- INSERT INTO public.dalkkot_restaurants (name, category, description) VALUES
-- ('...', '식당', '...')
-- → 관리자가 웹 UI에서 직접 입력하거나, 마이그레이션 시 추가
```

### 5-5. RLS 정책

```sql
-- db/migrations/20260309_05_dalkkot_rls.sql

-- helper function: is_dalkkot_admin
CREATE OR REPLACE FUNCTION public.is_dalkkot_admin(uid uuid)
RETURNS boolean
LANGUAGE sql
STABLE SECURITY DEFINER
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.profiles p
    WHERE p.id = uid AND p.is_dalkkot_admin = true
  );
$$;

-- ===== dalkkot_villas =====
ALTER TABLE public.dalkkot_villas ENABLE ROW LEVEL SECURITY;

-- 로그인 사용자는 읽기 가능
CREATE POLICY "villa_select_authenticated"
  ON public.dalkkot_villas FOR SELECT
  USING (auth.uid() IS NOT NULL);

-- 달콧 관리자만 수정 가능
CREATE POLICY "villa_update_admin"
  ON public.dalkkot_villas FOR UPDATE
  USING (public.is_dalkkot_admin(auth.uid()));

-- ===== dalkkot_reservations =====
ALTER TABLE public.dalkkot_reservations ENABLE ROW LEVEL SECURITY;

-- SELECT: 로그인 사용자는 공개 필드만 조회 (실명/전화 제외)
-- ※ 실명/전화는 서버에서 Service Role로만 조회 (관리자 API에서만 반환)
CREATE POLICY "reservation_select_authenticated"
  ON public.dalkkot_reservations FOR SELECT
  USING (auth.uid() IS NOT NULL);

-- INSERT: 로그인 사용자 본인 예약만
CREATE POLICY "reservation_insert_own"
  ON public.dalkkot_reservations FOR INSERT
  WITH CHECK (auth.uid() = user_id);

-- UPDATE: 본인의 pending/waiting_deposit 예약만 수정 가능
CREATE POLICY "reservation_update_own_pending"
  ON public.dalkkot_reservations FOR UPDATE
  USING (
    auth.uid() = user_id
    AND status IN ('pending', 'waiting_deposit')
  );

-- UPDATE: 달콧 관리자는 전체 수정 가능 (상태 변경 + 검침값 입력)
CREATE POLICY "reservation_update_admin"
  ON public.dalkkot_reservations FOR UPDATE
  USING (public.is_dalkkot_admin(auth.uid()));

-- ===== dalkkot_restaurants =====
ALTER TABLE public.dalkkot_restaurants ENABLE ROW LEVEL SECURITY;

-- 로그인 사용자는 읽기 가능
CREATE POLICY "restaurant_select_authenticated"
  ON public.dalkkot_restaurants FOR SELECT
  USING (auth.uid() IS NOT NULL);

-- 달콧 관리자만 추가/수정/삭제
CREATE POLICY "restaurant_insert_admin"
  ON public.dalkkot_restaurants FOR INSERT
  WITH CHECK (public.is_dalkkot_admin(auth.uid()));

CREATE POLICY "restaurant_update_admin"
  ON public.dalkkot_restaurants FOR UPDATE
  USING (public.is_dalkkot_admin(auth.uid()));

CREATE POLICY "restaurant_delete_admin"
  ON public.dalkkot_restaurants FOR DELETE
  USING (public.is_dalkkot_admin(auth.uid()));
```

**RLS 3케이스 권한 요약:**

| 기능 | 비로그인 | 일반 사용자 | 달콧 관리자 |
|------|---------|------------|------------|
| 캘린더 조회 | ❌ | ✅ (닉네임+날짜) | ✅ |
| 예약자 실명/전화 조회 | ❌ | ❌ | ✅ (서버 API) |
| 예약 신청 | ❌ | ✅ | ✅ |
| 본인 예약 취소 | ❌ | ✅ (pending/waiting) | ✅ |
| 상태 변경 (확정/반려) | ❌ | ❌ | ✅ |
| 검침값 입력 | ❌ | ❌ | ✅ |
| 이용수칙 편집 | ❌ | ❌ | ✅ |
| 맛집 추가/편집 | ❌ | ❌ | ✅ |

---

## 6. 구글 시트 데이터 마이그레이션 계획

### 6-1. 마이그레이션 대상

| 시트 탭 | → | DB 테이블 |
|---------|---|-----------|
| 이용방법 | → | `dalkkot_villas.rules`, `.description`, `.faq` |
| 26년예약일정 | → | `dalkkot_reservations` (is_migrated=true) |
| 25년예약일정 | → | `dalkkot_reservations` (is_migrated=true, 이력 보존용) |
| 맛집리스트 | → | `dalkkot_restaurants` |

### 6-2. 예약 데이터 마이그레이션 원칙

```
구글 시트 원본 형식: "3월7일" | "3월9일" | "지켜보고있다" | 비고
변환 형식:
  check_in:  DATE (YYYY-MM-DD) → 날짜 포맷 정규화 필수
  check_out: DATE
  nickname:  텍스트 그대로 (user_id는 NULL 허용 또는 관리자 계정으로)
  status:    '비고' 컬럼 기준:
               - 비어있음 → 'confirmed' (과거 이력은 전부 확정으로 간주)
               - '취소' → 'cancelled'
  is_migrated: true
  real_name:   NULL (시트에 없음)
  phone:       NULL (시트에 없음)
```

```sql
-- 마이그레이션 SQL 예시 (실제 날짜 정규화 후 실행)
-- db/migrations/20260309_06_dalkkot_migration_data.sql

INSERT INTO public.dalkkot_reservations
  (villa_id, user_id, nickname, check_in, check_out, status, is_migrated)
SELECT
  (SELECT id FROM public.dalkkot_villas WHERE name = '달콧' LIMIT 1),
  NULL,  -- 시트 이력은 user_id 없이 닉네임만 보존
  nickname,
  check_in::date,
  check_out::date,
  status,
  true
FROM (VALUES
  -- 2025년 이력 (구글 시트 → 정규화)
  ('지켜보고있다', '2024-03-07', '2024-03-09', 'confirmed'),
  ('잘살자',       '2024-03-08', '2024-03-10', 'confirmed'),
  -- ... (전체 시트 데이터 변환 후 추가)
  
  -- 2026년 현재 예약 (구글 시트 26년예약일정 탭)
  -- ※ 26년 시트 데이터는 관리자가 확인 후 직접 입력
) AS t(nickname, check_in, check_out, status);
```

> **⚠️ 마이그레이션 주의사항**
> - `user_id = NULL` 허용: 과거 이력은 계정과 무관하게 닉네임만 기록
> - 날짜 정규화: "3월7일" → "2024-03-07" (연도는 맥락에서 추정)
> - 26년 현재 예약은 관리자가 직접 웹에서 입력하거나 SQL로 삽입
> - 맛집리스트는 구글 시트 직접 확인 후 별도 CSV 작성하여 import

---

## 7. API 설계

### 7-1. Route Handler 목록

```
app/api/jeju/
├── villas/
│   ├── route.ts          GET   달콧 소개/수칙/FAQ 조회
│   └── [id]/
│       └── route.ts      PATCH 관리자: 소개/수칙 편집
│
├── reservations/
│   ├── route.ts          GET   목록 (월별 필터), POST 신청
│   └── [id]/
│       ├── route.ts      GET 상세, DELETE 취소(본인+pending)
│       ├── status/
│       │   └── route.ts  PATCH 관리자: 상태 변경
│       └── meters/
│           └── route.ts  PATCH 관리자: 검침값 입력
│
└── restaurants/
    ├── route.ts          GET 목록, POST 관리자 추가
    └── [id]/
        └── route.ts      PATCH·DELETE 관리자 편집/삭제
```

### 7-2. 관리자 전용 API 보안 처리

```typescript
// app/api/jeju/reservations/[id]/status/route.ts
// Service Role 클라이언트 + 서버에서 is_dalkkot_admin 체크

import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabaseAdmin'

export async function PATCH(req: Request, { params }: { params: { id: string } }) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  
  if (!user) return Response.json({ error: 'Unauthorized' }, { status: 401 })
  
  const { data: profile } = await supabase
    .from('profiles')
    .select('is_dalkkot_admin')
    .eq('id', user.id)
    .single()
  
  if (!profile?.is_dalkkot_admin) {
    return Response.json({ error: 'Forbidden' }, { status: 403 })
  }
  
  // Service Role로 상태 변경 (RLS 우회 가능하지만 이중 체크 후)
  const adminClient = createAdminClient()
  const { status } = await req.json()
  
  const { data, error } = await adminClient
    .from('dalkkot_reservations')
    .update({ status })
    .eq('id', params.id)
    .select()
    .single()
  
  if (error) return Response.json({ error: error.message }, { status: 500 })
  return Response.json(data)
}
```

### 7-3. 실명/전화번호 노출 제한

```typescript
// GET /api/jeju/reservations - 일반 사용자용 (공개 필드만)
const publicFields = 'id, nickname, check_in, check_out, status, color, villa_id'

// GET /api/jeju/admin/reservations - 관리자용 (전체 필드)
// → is_dalkkot_admin 체크 후 real_name, phone 포함 반환
```

---

## 8. 파일 구조 계획

```
app/jeju/
  layout.tsx                        ← 달콧 전용 레이아웃 (우드 헤더 + 네비)  
  page.tsx                          ← 홈 (Hero + 미니캘린더 + 통계)
  calendar/
    page.tsx                        ← 예약 캘린더 전체 뷰
  info/
    page.tsx                        ← 이용 수칙 / 소개
  restaurants/
    page.tsx                        ← 맛집 리스트
  admin/
    page.tsx                        ← 관리자 패널
    layout.tsx                      ← 관리자 인증 가드
  _components/                      ← 달콧 전용 공유 컴포넌트
    DalkkotNav.tsx                  ← 상단 내비게이션 (달콧 스타일)
    ReservationCalendar.tsx         ← 캘린더 컴포넌트 (React)
    ReservationModal.tsx            ← 예약 신청 모달 (이용수칙 동의 포함)
    ReservationDetailModal.tsx      ← 예약 상세 모달
    ReservationCard.tsx             ← 내 예약 상태 카드
    StatusBadge.tsx                 ← 상태 배지 (pending/waited/confirmed 등)
    StatsCards.tsx                  ← 통계 카드 4종
    MeterForm.tsx                   ← 공과금 검침값 입력 폼 (관리자)
    UtilityCalc.tsx                 ← 공과금 차액 자동 계산 표시
    RestaurantCard.tsx              ← 맛집 카드 컴포넌트
    VillaInfoEditor.tsx             ← 이용수칙 Markdown 편집기 (관리자)

app/api/jeju/
  villas/route.ts
  villas/[id]/route.ts
  reservations/route.ts
  reservations/[id]/route.ts
  reservations/[id]/status/route.ts
  reservations/[id]/meters/route.ts
  restaurants/route.ts
  restaurants/[id]/route.ts

db/migrations/
  20260309_01_profiles_dalkkot_admin.sql
  20260309_02_dalkkot_villas.sql
  20260309_03_dalkkot_reservations.sql
  20260309_04_dalkkot_restaurants.sql
  20260309_05_dalkkot_rls.sql
  20260309_06_dalkkot_migration_data.sql   ← 구글 시트 데이터
```

---

## 9. 달콧 UI 디자인 가이드 (dalkkot-main 재현)

### 9-1. Tailwind 커스텀 색상 추가

```javascript
// tailwind.config.ts 추가
theme: {
  extend: {
    colors: {
      dalkkot: {
        'wood-dark':  '#5C3D2E',   // 헤더/내비 배경
        'wood-mid':   '#8B5E3C',
        'wood-light': '#C4956A',
        'cream':      '#FDF6EC',   // 페이지 배경
        'cream-dark': '#F5EAD8',
        'sage':       '#7B9E87',   // 포인트 색상
        'sage-light': '#A8C4B0',
        'sage-dark':  '#4F7C5F',
      }
    }
  }
}
```

### 9-2. 달콧 레이아웃 구조

```tsx
// app/jeju/layout.tsx
// 달콧 전용 레이아웃 — 기존 JustGolf Header 대신 달콧 헤더 적용

<div className="min-h-screen bg-dalkkot-cream">
  <DalkkotNav />           {/* bg-dalkkot-wood-dark 상단 네비 */}  
  <main className="max-w-7xl mx-auto">
    {children}
  </main>
</div>
```

### 9-3. 캘린더 예약 색상 팔레트

달콧-main의 8색 팔레트 재사용 (사용자별 자동 순환 할당):

```typescript
export const RESERVATION_COLORS = [
  '#4CAF50', '#2196F3', '#FF9800', '#9C27B0',
  '#E91E63', '#00BCD4', '#FF5722', '#607D8B'
]
// 신규 예약 시 기존 예약 색상 중 안 쓰인 색 우선 배정
```

---

## 10. 예약 신청 UX 흐름 (상세)

```
① 캘린더에서 빈 날짜 클릭
       ↓
② 예약 신청 모달 오픈
   ┌────────────────────────────────┐
   │ [이용 수칙] 스크롤 영역        │
   │ (이용방법 탭 핵심 내용 표시)   │
   │                               │
   │ [☑ 이용 수칙을 확인했습니다]  │
   │                               │
   │ 닉네임: [자동 표시, 수정 불가] │
   │ 실명*:  [______]              │
   │ 연락처*:[______]              │
   │ 체크인: [YYYY-MM-DD]          │
   │ 체크아웃:[YYYY-MM-DD]         │
   │ 인원:   [선택]                │
   │ 비고:   [선택]                │
   │                               │  
   │     [취소]  [예약 신청]       │
   └────────────────────────────────┘
       ↓
③ status = 'pending' 저장
   → 캘린더에 즉시 반투명 블록으로 표시
       ↓
④ 관리자 알림 (향후: 카톡/이메일)
       ↓
⑤ 관리자가 실명/전화 확인 → [입금 요청] 클릭
   status = 'waiting_deposit'
   → 캘린더 블록 주황 경계선으로 변경
       ↓
⑥ 입금 완료 → 관리자가 [입금 확인·최종 확정] 클릭
   status = 'confirmed'
   → 캘린더 블록 색상 진하게 변경
```

---

## 11. 공과금 정산 기능

```
관리자 패널 → 확정 목록 → 해당 예약 클릭 → [검침값 입력]

┌─────────────────────────────────────┐
│  공과금 검침값 입력                  │
│                                     │
│  가스    입실: [  ] → 퇴실: [  ]   │
│  수도    입실: [  ] → 퇴실: [  ]   │  
│  전기    입실: [  ] → 퇴실: [  ]   │
│                                     │
│  특이사항: [예: 검침기 고장]        │
│                                     │
│  ─ 계산 결과 ─────────────────────  │
│  가스 △X m³ × 5,200원 = ₩XX,XXX   │
│  수도 △X ㎥ = 별도 정산             │
│  전기 △X kWh = 별도 정산           │
│                                     │
│         [저장]                      │
└─────────────────────────────────────┘
```

---

## 12. 구현 착수 체크리스트

### Phase 1 — DB 마이그레이션 (사전 작업)
- [ ] `20260309_01~05` SQL 파일 작성 완료
- [ ] Supabase SQL Editor에서 순서대로 실행
- [ ] `is_dalkkot_admin = true` 계정 1개 설정
- [ ] `dalkkot_villas` 초기 데이터 확인
- [ ] 구글 시트 맛집리스트 수동 정리 후 CSV 작성
- [ ] 2026년 예약 현황 정규화 후 migration SQL 작성

### Phase 2 — 레이아웃 & 공통 컴포넌트
- [ ] Tailwind config 달콧 팔레트 추가
- [ ] `app/jeju/layout.tsx` — 달콧 헤더 네비
- [ ] `DalkkotNav.tsx` — 5개 탭 내비게이션
- [ ] `StatusBadge.tsx` — 5개 상태 배지

### Phase 3 — 예약 캘린더
- [ ] `ReservationCalendar.tsx` — 월별 캘린더 렌더링
- [ ] 예약 상태별 색상/스타일 처리
- [ ] 날짜 클릭 → 예약 신청 모달 연결
- [ ] `ReservationModal.tsx` — 이용수칙 동의 + 입력 폼

### Phase 4 — 각 페이지
- [ ] `/jeju` — 홈 (영웅 섹션 + 미니캘린더 + 내 예약)
- [ ] `/jeju/calendar` — 캘린더 전체 뷰 + 예약 목록
- [ ] `/jeju/info` — 이용 수칙 페이지
- [ ] `/jeju/restaurants` — 맛집 리스트 페이지

### Phase 5 — 관리자 패널
- [ ] `is_dalkkot_admin` 인증 가드 미들웨어/layout
- [ ] 신청 목록 + 상태 변경 (입금요청/확정/반려)
- [ ] 실명/전화번호 확인 UI
- [ ] 검침값 입력 + 공과금 계산 표시
- [ ] 이용수칙 편집 (Markdown)
- [ ] 맛집 추가/편집

### Phase 6 — API Route Handler
- [ ] `GET /api/jeju/reservations` (월별 필터, 공개 필드만)
- [ ] `POST /api/jeju/reservations` (예약 신청)
- [ ] `PATCH /api/jeju/reservations/[id]/status` (관리자 상태 변경)
- [ ] `PATCH /api/jeju/reservations/[id]/meters` (검침값 입력)
- [ ] `GET /api/jeju/villas` (소개/수칙 조회)
- [ ] `PATCH /api/jeju/villas/[id]` (관리자 편집)
- [ ] `GET/POST /api/jeju/restaurants` (맛집 목록/추가)

### 완료 조건 (DoD)
- [ ] `npm run build` 성공
- [ ] 중복 예약 차단 (DB 제약 + UI 검증)
- [ ] 비로그인 → `/jeju/calendar` 접근 시 로그인 리다이렉트
- [ ] 일반 사용자 → `/jeju/admin` 접근 차단
- [ ] 관리자 화면에서 실명/전화 정상 표시, 일반 화면에서 미표시
- [ ] 예약 상태 흐름 (신청→입금요청→입금확인→확정) 전체 E2E 동작
- [ ] 공과금 검침값 입력 → 자동 계산 표시
- [ ] 구글 시트 마이그레이션 데이터 캘린더에 정상 표시
- [ ] 모바일 레이아웃 확인

---

## 13. 리스크 및 주의사항

| 리스크 | 대응 |
|--------|------|
| 비밀번호(대문/현관)/Wi-Fi 정보 웹 노출 | `/jeju/info` 페이지는 로그인 사용자만 접근, 해당 정보는 정적으로 포함 **금지** — 별도 안전한 채널 (카톡) 유지 |
| 구글 시트 닉네임 ≠ 웹서비스 닉네임 | 마이그레이션 시 `is_migrated=true` + `user_id=NULL`로 이력 보존. 향후 연결은 별도 작업. |
| 날짜 형식 정규화 오류 | "3월7일" → "2024-03-07" 변환 시 연도 오류 주의. 마이그레이션 SQL 수동 검토 필수. |
| `is_admin` vs `is_dalkkot_admin` 혼용 | 달콧 관련 모든 권한 체크는 `is_dalkkot_admin`만 사용. `is_admin`은 골프 대회 기능 전용. |
| 공과금 단가 변동 | `gas_per_unit` 상수를 코드에 하드코딩 금지. `dalkkot_villas` 테이블에 컬럼 추가 또는 환경변수로 관리. |
| `user_id NULL` 마이그레이션 데이터 | RLS `INSERT WITH CHECK (user_id = auth.uid())` 조건에서 제외 — 마이그레이션은 Service Role로 실행. |
