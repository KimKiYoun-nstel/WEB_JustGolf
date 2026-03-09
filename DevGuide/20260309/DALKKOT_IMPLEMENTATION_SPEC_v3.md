# 달콧 별장 예약 시스템 — 구현 설계서 v3.0

> 작성일: 2026-03-09 | 브랜치: `feature-dalkkot`
> 이전 문서: DALKKOT_SYSTEM_DESIGN_v2.md

---

## 1. 아키텍처 원칙

### 공유 vs 독립 경계

```
JustGolf 전체 서비스
│
├── [공유] Supabase Auth (auth.users)        ← 동일한 로그인 세션 사용
├── [공유] public.profiles                   ← 닉네임, is_dalkkot_admin 컬럼 추가
│
└── [독립] /jeju/* 페이지
    ├── 독립 레이아웃 (달콧 헤더/네비)
    ├── 달콧 전용 DB 테이블 (모두 dalkkot_ prefix)
    └── 달콧 전용 API (/api/jeju/*)
```

**공유하는 것**
- `auth.users` — 로그인 세션만 공유
- `public.profiles.nickname` — 캘린더 표시용 닉네임
- `public.profiles.is_approved` — 가입 승인 여부 (접근 제어)
- `lib/supabase/server.ts`, `lib/supabaseAdmin.ts` — 클라이언트 유틸

**독립적인 것 (달콧 전용)**
- 레이아웃, 네비게이션, 색상 테마
- 모든 데이터: `dalkkot_villas`, `dalkkot_reservations`, `dalkkot_restaurants`, `dalkkot_restaurant_comments`, `dalkkot_restaurant_likes`
- 달콧 전용 관리자 권한: `profiles.is_dalkkot_admin`

---

## 2. DB 스키마 전체 (마이그레이션 SQL)

> 모든 파일은 `db/migrations/` 에 저장하고, **Supabase SQL Editor에서 번호 순서대로 실행**

### 파일 1: `20260309_01_profiles_dalkkot.sql`

```sql
-- profiles 테이블에 달콧 전용 컬럼 추가
ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS is_dalkkot_admin BOOLEAN NOT NULL DEFAULT false;

-- 헬퍼 함수 (RLS에서 사용)
CREATE OR REPLACE FUNCTION public.is_dalkkot_admin(uid uuid)
RETURNS boolean
LANGUAGE sql STABLE SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.profiles
    WHERE id = uid AND is_dalkkot_admin = true
  );
$$;
```

### 파일 2: `20260309_02_dalkkot_villas.sql`

```sql
-- 별장 정보 및 CMS 콘텐츠
CREATE TABLE IF NOT EXISTS public.dalkkot_villas (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name          TEXT NOT NULL DEFAULT '달콧',
  address       TEXT,
  naver_map_url TEXT,                     -- 네이버지도 링크
  kakao_map_url TEXT,                     -- 카카오맵 링크
  -- 콘텐츠 (관리자 편집 가능, Markdown)
  intro_md      TEXT,                     -- 별장 소개
  rules_md      TEXT,                     -- 이용 수칙
  faq_md        TEXT,                     -- FAQ
  -- 공과금 단가 (정산 계산용)
  gas_unit_price     INTEGER DEFAULT 5200,  -- 원/m³
  -- 활성화 여부
  is_active     BOOLEAN NOT NULL DEFAULT true,
  created_at    TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at    TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TRIGGER trg_dalkkot_villas_updated_at
  BEFORE UPDATE ON public.dalkkot_villas
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- 초기 달콧 데이터
INSERT INTO public.dalkkot_villas
  (name, address, intro_md, rules_md, faq_md)
VALUES (
  '달콧',
  '제주특별자치도 제주시 조천읍 조함해안로 17-7',
  '## 달콧 별장에 오신 것을 환영합니다

제주 조천읍 해안가에 위치한 달콧 별장입니다.
동호회 지인 전용으로 운영되는 공간입니다.

**공과금 사용한만큼 후불, 셀프청소**',

  '## 이용 수칙

- 퇴실할 때 보일러 켜진상태로 놓아주시고 퇴실카톡 부탁드립니다
- 대문, 현관은 항상 닫힌상태로 유지해주세요
- 제주는 바람이 많이 불어 위험할 수 있습니다
- 화장실에 물티슈 사용불가 (옆집 배관 막힘 위험)
- 쓰레기는 밖에 모아두었다가 버려주세요
- 음식물쓰레기는 티머니 카드로 태그하고 버릴 수 있습니다
- 퇴실할 때 술 외의 모든 음식물은 처리부탁드립니다
- 안거리 보일러는 20도 난방에 맞춰 놓고 퇴실바랍니다
- 밖거리 전기보일러는 꺼주세요
- 숙소점검 왔다고 하면 동호회 지인이 빌려준 것이라고 말씀해주세요
- 창고안 세탁기의 멀티탭은 항상 켜놔 주세요 (대문 앱 제어용)
- 커피는 일리 캡슐만 사용 가능합니다 (다른 캡슐 호환 안됨)',

  '## FAQ

**Q. 주차는 어디에 하나요?**
골목으로 진입하여 녹색 위치에 주차. 좋은 자리는 주민들께 양보해주세요.

**Q. 와이파이 정보는?**
관리자에게 별도 문의해주세요.

**Q. 커피머신 캡슐은?**
일리(illy) 다크로스트 캡슐 전용. 캡슐 모양 확인 필수 (호환 안됨).'
);

-- RLS
ALTER TABLE public.dalkkot_villas ENABLE ROW LEVEL SECURITY;

CREATE POLICY "villas_select_approved"
  ON public.dalkkot_villas FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM public.profiles
      WHERE id = auth.uid() AND is_approved = true
    )
  );

CREATE POLICY "villas_update_dalkkot_admin"
  ON public.dalkkot_villas FOR UPDATE
  USING (public.is_dalkkot_admin(auth.uid()));
```

### 파일 3: `20260309_03_dalkkot_reservations.sql`

```sql
-- 예약 테이블
CREATE EXTENSION IF NOT EXISTS btree_gist;

CREATE TABLE IF NOT EXISTS public.dalkkot_reservations (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  villa_id        UUID NOT NULL REFERENCES public.dalkkot_villas(id) ON DELETE CASCADE,
  user_id         UUID REFERENCES auth.users(id) ON DELETE SET NULL,  -- 마이그레이션 데이터는 NULL 허용

  -- 공개 필드 (캘린더 표시)
  nickname        TEXT NOT NULL,
  check_in        DATE NOT NULL,
  check_out       DATE NOT NULL,
  color           TEXT NOT NULL DEFAULT '#4CAF50',

  -- 관리자 전용 필드 (RLS로 보호)
  real_name       TEXT,
  phone           TEXT,
  guests          SMALLINT,
  notes           TEXT,

  -- 결제/상태
  status          TEXT NOT NULL DEFAULT 'pending'
                    CHECK (status IN (
                      'pending',           -- 신청 완료, 검토 대기
                      'waiting_deposit',   -- 입금 요청됨
                      'confirmed',         -- 입금 확인, 최종 확정
                      'rejected',          -- 관리자 반려
                      'cancelled'          -- 신청자 본인 취소
                    )),

  -- 공과금 검침값 (관리자 입력, 퇴실 후)
  gas_meter_in    NUMERIC(8,3),
  gas_meter_out   NUMERIC(8,3),
  water_meter_in  NUMERIC(8,1),
  water_meter_out NUMERIC(8,1),
  elec_meter_in   NUMERIC(10,1),
  elec_meter_out  NUMERIC(10,1),
  meter_notes     TEXT,

  -- 마이그레이션 여부
  is_migrated     BOOLEAN NOT NULL DEFAULT false,

  created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),

  CONSTRAINT chk_dates CHECK (check_out > check_in)
);

CREATE TRIGGER trg_dalkkot_reservations_updated_at
  BEFORE UPDATE ON public.dalkkot_reservations
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- 날짜 중복 방지 (rejected·cancelled 제외)
ALTER TABLE public.dalkkot_reservations
  ADD CONSTRAINT no_overlap_reservations
  EXCLUDE USING gist (
    villa_id WITH =,
    daterange(check_in, check_out, '[)') WITH &&
  ) WHERE (status NOT IN ('rejected', 'cancelled'));

-- 인덱스
CREATE INDEX idx_dalkkot_res_check_in  ON public.dalkkot_reservations(check_in);
CREATE INDEX idx_dalkkot_res_status    ON public.dalkkot_reservations(status);
CREATE INDEX idx_dalkkot_res_user_id   ON public.dalkkot_reservations(user_id);

-- RLS
ALTER TABLE public.dalkkot_reservations ENABLE ROW LEVEL SECURITY;

-- 승인된 로그인 사용자는 공개 필드 조회 가능
-- ※ 실명/전화는 서버 API에서 Service Role로만 반환 (RLS로는 제어 불가 → API 레벨 필터링)
CREATE POLICY "reservations_select_approved"
  ON public.dalkkot_reservations FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM public.profiles
      WHERE id = auth.uid() AND is_approved = true
    )
  );

-- 본인 예약 생성
CREATE POLICY "reservations_insert_own"
  ON public.dalkkot_reservations FOR INSERT
  WITH CHECK (auth.uid() = user_id);

-- 본인의 pending/waiting_deposit 예약 수정 (취소 목적)
CREATE POLICY "reservations_update_own_pending"
  ON public.dalkkot_reservations FOR UPDATE
  USING (
    auth.uid() = user_id
    AND status IN ('pending', 'waiting_deposit')
  )
  WITH CHECK (
    auth.uid() = user_id
    AND status = 'cancelled'   -- 본인은 취소만 가능
  );

-- 달콧 관리자: 전체 수정 가능
CREATE POLICY "reservations_update_admin"
  ON public.dalkkot_reservations FOR UPDATE
  USING (public.is_dalkkot_admin(auth.uid()));
```

### 파일 4: `20260309_04_dalkkot_restaurants.sql`

```sql
-- 맛집 리스트 (누구나 추가/편집, 편집자 기록)
CREATE TYPE dalkkot_restaurant_category AS ENUM (
  '식당', '카페', '베이커리', '술집', '편의점', '기타'
);

CREATE TABLE IF NOT EXISTS public.dalkkot_restaurants (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name        TEXT NOT NULL,
  category    dalkkot_restaurant_category NOT NULL DEFAULT '식당',
  address     TEXT,
  description TEXT,          -- 추천 메뉴, 특징 메모 (Markdown 지원)
  map_url     TEXT,          -- 카카오맵/네이버지도 링크
  -- 편집 이력
  added_by    UUID NOT NULL REFERENCES auth.users(id),
  updated_by  UUID REFERENCES auth.users(id),
  -- 집계 (캐싱)
  like_count  INTEGER NOT NULL DEFAULT 0,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TRIGGER trg_dalkkot_restaurants_updated_at
  BEFORE UPDATE ON public.dalkkot_restaurants
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- 좋아요 테이블 (유저당 1회)
CREATE TABLE IF NOT EXISTS public.dalkkot_restaurant_likes (
  restaurant_id UUID NOT NULL REFERENCES public.dalkkot_restaurants(id) ON DELETE CASCADE,
  user_id       UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  created_at    TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  PRIMARY KEY (restaurant_id, user_id)
);

-- 댓글 테이블
CREATE TABLE IF NOT EXISTS public.dalkkot_restaurant_comments (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  restaurant_id UUID NOT NULL REFERENCES public.dalkkot_restaurants(id) ON DELETE CASCADE,
  user_id       UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  content       TEXT NOT NULL,
  created_at    TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at    TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TRIGGER trg_dalkkot_comments_updated_at
  BEFORE UPDATE ON public.dalkkot_restaurant_comments
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- 좋아요 수 자동 업데이트 트리거
CREATE OR REPLACE FUNCTION public.sync_restaurant_like_count()
RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
  UPDATE public.dalkkot_restaurants
  SET like_count = (
    SELECT COUNT(*) FROM public.dalkkot_restaurant_likes
    WHERE restaurant_id = COALESCE(NEW.restaurant_id, OLD.restaurant_id)
  )
  WHERE id = COALESCE(NEW.restaurant_id, OLD.restaurant_id);
  RETURN NULL;
END;
$$;

CREATE TRIGGER trg_sync_like_count
  AFTER INSERT OR DELETE ON public.dalkkot_restaurant_likes
  FOR EACH ROW EXECUTE FUNCTION public.sync_restaurant_like_count();

-- RLS
ALTER TABLE public.dalkkot_restaurants ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.dalkkot_restaurant_likes ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.dalkkot_restaurant_comments ENABLE ROW LEVEL SECURITY;

-- 승인된 사용자는 모두 조회 가능
CREATE POLICY "restaurants_select_approved"
  ON public.dalkkot_restaurants FOR SELECT
  USING (EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND is_approved = true));

-- 승인된 사용자는 맛집 추가 가능
CREATE POLICY "restaurants_insert_approved"
  ON public.dalkkot_restaurants FOR INSERT
  WITH CHECK (
    auth.uid() = added_by AND
    EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND is_approved = true)
  );

-- 본인이 추가한 항목 또는 달콧 관리자만 편집/삭제
CREATE POLICY "restaurants_update_own_or_admin"
  ON public.dalkkot_restaurants FOR UPDATE
  USING (auth.uid() = added_by OR public.is_dalkkot_admin(auth.uid()));

CREATE POLICY "restaurants_delete_own_or_admin"
  ON public.dalkkot_restaurants FOR DELETE
  USING (auth.uid() = added_by OR public.is_dalkkot_admin(auth.uid()));

-- 좋아요: 승인된 사용자 1인 1회
CREATE POLICY "likes_select_approved"
  ON public.dalkkot_restaurant_likes FOR SELECT
  USING (EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND is_approved = true));

CREATE POLICY "likes_insert_own"
  ON public.dalkkot_restaurant_likes FOR INSERT
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "likes_delete_own"
  ON public.dalkkot_restaurant_likes FOR DELETE
  USING (auth.uid() = user_id);

-- 댓글: 승인된 사용자 작성, 본인 댓글만 수정/삭제
CREATE POLICY "comments_select_approved"
  ON public.dalkkot_restaurant_comments FOR SELECT
  USING (EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND is_approved = true));

CREATE POLICY "comments_insert_own"
  ON public.dalkkot_restaurant_comments FOR INSERT
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "comments_update_own"
  ON public.dalkkot_restaurant_comments FOR UPDATE
  USING (auth.uid() = user_id);

CREATE POLICY "comments_delete_own_or_admin"
  ON public.dalkkot_restaurant_comments FOR DELETE
  USING (auth.uid() = user_id OR public.is_dalkkot_admin(auth.uid()));
```

---

## 3. 데이터 마이그레이션 방법 (단계별 가이드)

> **결론**: 예약 이력은 관리자용 CSV 업로드 UI로, 이용수칙/맛집은 관리자 웹 편집기로 처리.
> 직접 SQL을 작성하지 않아도 됩니다.

### 3-1. 마이그레이션 흐름 전체

```
STEP 1 │ DB 스키마 생성 (SQL Editor 1회 실행)
       │ → db/migrations/ 파일들을 Supabase SQL Editor에 붙여넣어 실행
       ↓
STEP 2 │ 이용수칙/소개 콘텐츠 편집
       │ → /jeju/admin 페이지의 "콘텐츠 편집" 탭에서 Markdown으로 직접 편집
       │ → 초기값은 파일 2(villas.sql)의 INSERT로 미리 입력됨
       ↓
STEP 3 │ 예약 이력 마이그레이션 (핵심)
       │ → 구글 시트에서 CSV 다운로드
       │ → /jeju/admin/migrate 페이지에서 CSV 업로드
       │ → 미리보기 확인 후 [일괄 저장] 클릭
       ↓
STEP 4 │ 맛집 리스트 입력
       │ → /jeju/restaurants 페이지에서 [+ 맛집 추가] 버튼으로 직접 입력
       │ → 누구나 추가 가능 (관리자 포함)
       ↓
STEP 5 │ 달콧 관리자 계정 설정
       │ → Supabase Dashboard > Table Editor > profiles 테이블
       │ → 관리자 계정의 is_dalkkot_admin 컬럼을 true로 설정
```

### 3-2. 예약 이력 CSV 마이그레이션 상세

**구글 시트에서 CSV 만들기:**
1. 구글 시트 열기 → `제주별장달콧이용내역` 탭 선택
2. 파일 → 다운로드 → CSV
3. 엑셀에서 열어 아래 형식으로 수정

**CSV 필수 컬럼:**
```csv
nickname,check_in,check_out,status,notes
지켜보고있다,2024-03-07,2024-03-09,confirmed,
잘살자,2024-03-08,2024-03-10,confirmed,
지인,2024-04-02,2024-04-30,confirmed,
이용대,2024-04-30,2024-05-10,confirmed,
살자,2024-06-05,2024-06-10,cancelled,취소
...
```

**날짜 변환 규칙:**
- "3월7일" → "2024-03-07" (이용내역 탭은 2024년 기준)
- "1월4일" → "2025-01-04" (2025 행 이하)
- 날짜가 "11.12" 형식 → "2025-11-12"

**status 변환 규칙:**
- 비고 없음 → `confirmed`
- "취소" → `cancelled`
- "확정!" 텍스트 있음 → `confirmed`

**관리자 CSV 업로드 UI (`/jeju/admin/migrate`):**
```
┌─────────────────────────────────────────┐
│  예약 이력 마이그레이션                   │
│                                         │
│  [CSV 파일 선택 또는 드롭]               │
│                                         │
│  미리보기 테이블:                        │
│  ┌────────┬───────────┬────────────┐    │
│  │닉네임  │ 체크인    │ 체크아웃   │    │
│  ├────────┼───────────┼────────────┤    │
│  │지켜보..│ 2024-03-07│ 2024-03-09 │    │
│  │...     │ ...       │ ...        │    │
│  └────────┴───────────┴────────────┘    │
│                                         │
│  ⚠️ 날짜 오류: 3건 (빨간 행으로 표시)   │
│  ✅ 정상: 82건                          │
│                                         │
│      [취소]    [일괄 저장]              │
└─────────────────────────────────────────┘
```

**API 구현 (`/api/jeju/admin/migrate`):**
- Service Role 클라이언트로 `user_id=NULL`, `is_migrated=true`로 일괄 INSERT
- 날짜 유효성 검증 + 중복 날짜 충돌 체크 후 미리보기 반환
- 확인 후 일괄 저장

### 3-3. 작업 소요 시간 예상

| 작업 | 난이도 | 예상 시간 |
|------|--------|-----------|
| SQL Editor 스키마 실행 | 쉬움 | 10분 |
| 이용수칙 편집 (웹 편집기) | 쉬움 | 20분 |
| 구글 시트 → CSV 변환 | 보통 | 1~2시간 (날짜 정규화) |
| CSV 업로드 → 확인 | 쉬움 | 10분 |
| 맛집 리스트 입력 (웹 UI) | 쉬움 | 시트 내용 보면서 30분~1시간 |
| 관리자 계정 설정 | 쉬움 | 5분 |

---

## 4. middleware.ts 수정 계획

`/jeju` 경로를 미들웨어 보호 대상에 추가:

```typescript
// middleware.ts 수정 (기존 코드에 /jeju 경로 추가)

// 기존:
if (!isAdmin && (request.nextUrl.pathname.startsWith("/start") || 
    request.nextUrl.pathname.startsWith("/admin") ||
    request.nextUrl.pathname.startsWith("/tournaments"))) {

// 변경 후:
if (!isAdmin && (request.nextUrl.pathname.startsWith("/start") || 
    request.nextUrl.pathname.startsWith("/admin") ||
    request.nextUrl.pathname.startsWith("/tournaments") ||
    request.nextUrl.pathname.startsWith("/jeju"))) {
```

달콧 관리자 전용 경로는 layout.tsx에서 서버 컴포넌트로 2차 체크:

```typescript
// app/jeju/admin/layout.tsx
import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'

export default async function DalkkotAdminLayout({ children }) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  
  const { data: profile } = await supabase
    .from('profiles')
    .select('is_dalkkot_admin')
    .eq('id', user!.id)
    .single()
  
  if (!profile?.is_dalkkot_admin) redirect('/jeju')
  
  return <>{children}</>
}
```

---

## 5. 페이지별 구현 상세 스펙

### 5-1. `/jeju` — 홈 페이지 (Server Component)

```
레이아웃 구조:
┌─────────────────────────────────────────────────────┐
│  [달콧 내비게이션]  홈|캘린더|이용수칙|맛집|[관리]  │
│  bg-dalkkot-wood-dark, 64px height                  │
├─────────────────────────────────────────────────────┤
│  [Hero 섹션]                                        │
│  배경: 우드/크림 그라디언트                          │
│  텍스트: "달콧 별장 예약 관리"                      │
│  서브: "편리하게 예약하세요"                        │
│  버튼: [예약하러 가기 →]                            │
├───────────────┬─────────────────────────────────────┤
│  [통계 카드]  │  이번달 전체 / 확정 / 대기 / 빈날수  │
├───────────────┴─────────────────────────────────────┤
│  [이번 달 미니 캘린더]                              │
│  예약자 닉네임 + 색상 블록 표시                     │
├───────────────┬─────────────────────────────────────┤
│  [내 예약 현황 카드] (로그인 사용자)                │
│  상태 배지 + 날짜 표시                              │
│  [예약 신청하기] 버튼                               │
└─────────────────────────────────────────────────────┘

서버 데이터 페칭:
- 이번 달 예약 목록 (공개 필드만)
- 내 예약 목록 (user_id = 현재 유저)
```

### 5-2. `/jeju/calendar` — 예약 캘린더 (Client + Server)

```
페이지 구조:
┌──────────────────────────────────────────────────────┐
│  [페이지 헤더]  예약 캘린더  [+ 예약 신청]           │
├──────────────────────────┬───────────────────────────┤
│  [캘린더 패널]           │  [내 예약 목록 패널]       │
│  ← 2026년 3월 →  [⊞][≡]│  ┌─────────────────────┐  │
│  일 월 화 수 목 금 토   │  │ 빠빠라찌             │  │
│  ┌──┬──┬──┬──┬──┬──┬──┐│  │ 3/15 ~ 3/20 · 대기  │  │
│  │  │  │  │  │  │  │1 ││  │ [취소]              │  │
│  │2 │3▣│4 │5 │6 │7 │8 ││  └─────────────────────┘  │
│  │  │닉│  │  │  │  │  ││                            │
│  └──┴──┴──┴──┴──┴──┴──┘│                            │
│  ▣ = 예약 색상 블록     │                            │
├──────────────────────────┴───────────────────────────┤
│  [이번 달 전체 예약 목록]                            │
│  예약자 | 체크인 | 체크아웃 | 인원 | 상태            │
└──────────────────────────────────────────────────────┘

인터랙션:
- 날짜 클릭 (빈 날짜) → ReservationModal 오픈
- 예약 블록 클릭 → ReservationDetailModal 오픈
- 본인 예약이면 [취소] 버튼 표시
- ← → 버튼으로 월 이동
- ⊞(격자)/≡(리스트) 뷰 전환
```

### 5-3. `/jeju/info` — 이용 수칙 (Server Rendered)

```
페이지 구조:
┌─────────────────────────────────────────────────────┐
│  [별장 소개]             [관리자: 편집 버튼]         │
│  intro_md 렌더링 (Markdown → HTML)                  │
├─────────────────────────────────────────────────────┤
│  [이용 수칙]                                        │
│  rules_md 렌더링                                    │
├─────────────────────────────────────────────────────┤
│  [위치 및 교통]                                     │
│  주소 + 지도 링크 (네이버/카카오)                   │
├─────────────────────────────────────────────────────┤
│  [FAQ]                                              │
│  faq_md 렌더링 (아코디언 형태)                      │
└─────────────────────────────────────────────────────┘

관리자 편집 모드:
- 우측 상단 [편집] 버튼 (is_dalkkot_admin에게만 보임)
- 클릭 시 각 섹션이 Markdown 텍스트에어리어로 전환
- [저장] → PATCH /api/jeju/villas/{id}
```

### 5-4. `/jeju/restaurants` — 맛집 리스트 (Client Component)

```
페이지 구조:
┌─────────────────────────────────────────────────────┐
│  [필터 탭]  전체 | 식당 | 카페 | 베이커리 | 술집    │
│                                          [+ 추가]    │
├─────────────────────────────────────────────────────┤
│  ┌────────────────┐  ┌────────────────┐             │
│  │  [가게 카드]   │  │  [가게 카드]   │             │
│  │  🍜 고기국수  │  │  ☕ 감귤카페  │             │
│  │  카테고리: 식당│  │  카테고리: 카페│             │
│  │  주소: ...     │  │  주소: ...     │             │
│  │  추천: ...     │  │  추천: ...     │             │
│  │  ──────────── │  │  ──────────── │             │
│  │  등록: 빠빠라찌│  │  등록: 잘살자  │             │
│  │  ❤️ 5  💬 2  │  │  ❤️ 3  💬 0  │             │
│  │  [수정] [삭제] │  │                │             │
│  └────────────────┘  └────────────────┘             │
├─────────────────────────────────────────────────────┤
│  [댓글 영역] (카드 클릭 시 확장)                    │
│  잘살자: "여기 흑돼지 진짜 맛있어요!"               │
│  [댓글 입력]                             [등록]     │
└─────────────────────────────────────────────────────┘

권한:
- 모든 승인 사용자: 조회, 추가, 좋아요, 댓글
- 본인 등록 항목: 수정, 삭제
- 달콧 관리자: 모든 항목 수정/삭제
```

### 5-5. `/jeju/admin` — 관리자 패널

```
탭 구성:
┌──────────────────────────────────────────────────────┐
│  [예약관리] | [마이그레이션] | [콘텐츠편집]          │
└──────────────────────────────────────────────────────┘

─ [예약관리 탭] ─────────────────────────────────────
  [대기 중] 섹션:
  닉네임 | 실명 | 연락처 | 체크인 | 체크아웃 | 인원 | 신청일
  [입금요청] [반려] 버튼

  [입금대기] 섹션:
  닉네임 | 체크인 | 체크아웃
  [입금확인·최종확정] [반려] 버튼

  [확정 목록] 섹션:
  닉네임 | 체크인 | 체크아웃 | [검침값 입력] 버튼

─ [마이그레이션 탭] ──────────────────────────────────
  CSV 업로드 UI (상세는 Section 3 참조)

─ [콘텐츠편집 탭] ───────────────────────────────────
  별장 소개 / 이용수칙 / FAQ Markdown 편집기
```

---

## 6. 컴포넌트 구현 계획

### 6-1. 파일 구조

```
app/jeju/
  layout.tsx                    ← 달콧 독립 레이아웃 (달콧 헤더 포함)
  page.tsx                      ← 홈 (Server Component)
  calendar/
    page.tsx                    ← 캘린더 페이지 (Server로 초기 데이터 패칭)
    CalendarClient.tsx          ← 'use client' - 캘린더 인터랙션
  info/
    page.tsx                    ← 이용수칙 (Server Component)
  restaurants/
    page.tsx                    ← 맛집 리스트
    RestaurantsClient.tsx       ← 'use client' - 필터/좋아요/댓글
  admin/
    layout.tsx                  ← 관리자 인증 가드
    page.tsx                    ← 관리자 패널 (탭 레이아웃)
    migrate/
      page.tsx                  ← CSV 마이그레이션 UI

  _components/
    DalkkotHeader.tsx           ← 달콧 헤더 (우드 배경, 5개 탭 내비)
    DalkkotLayout.tsx           ← 공통 래퍼
    
    // 캘린더
    ReservationCalendar.tsx     ← 캘린더 렌더링 (월별 그리드)
    CalendarCell.tsx            ← 날짜 셀 (예약 블록 포함)
    ReservationModal.tsx        ← 예약 신청 모달
    ReservationDetailModal.tsx  ← 예약 상세 모달
    
    // 공통 UI
    StatusBadge.tsx             ← 상태 배지 (5종)
    StatsCards.tsx              ← 통계 카드
    
    // 맛집
    RestaurantCard.tsx          ← 맛집 카드
    RestaurantForm.tsx          ← 맛집 추가/편집 폼
    CommentSection.tsx          ← 댓글 영역
    LikeButton.tsx              ← 좋아요 버튼 (optimistic update)
    
    // 관리자
    AdminReservationTable.tsx   ← 관리자용 예약 목록 테이블
    MeterInputForm.tsx          ← 공과금 검침값 입력
    MigrationUploader.tsx       ← CSV 업로드 컴포넌트
    VillaContentEditor.tsx      ← Markdown 편집기

app/api/jeju/
  villas/
    route.ts                    ← GET (정보 조회)
    [id]/
      route.ts                  ← PATCH (관리자: 콘텐츠 편집)
  reservations/
    route.ts                    ← GET (월별 목록), POST (신청)
    [id]/
      route.ts                  ← DELETE (본인 취소)
      status/
        route.ts                ← PATCH (관리자: 상태 변경)
      meters/
        route.ts                ← PATCH (관리자: 검침값)
  restaurants/
    route.ts                    ← GET (목록), POST (추가)
    [id]/
      route.ts                  ← PATCH, DELETE
      likes/
        route.ts                ← POST (좋아요), DELETE (좋아요 취소)
      comments/
        route.ts                ← GET (목록), POST (작성)
        [commentId]/
          route.ts              ← PATCH (수정), DELETE (삭제)
  admin/
    migrate/
      route.ts                  ← POST (CSV 파싱 + 미리보기)
      confirm/
        route.ts                ← POST (일괄 저장, Service Role)
```

### 6-2. 핵심 컴포넌트 코드 스케치

**`ReservationCalendar.tsx` — 캘린더 그리드**
```typescript
'use client'
// dalkkot-main의 buildCalendarHTML 로직을 React로 이식
// props: reservations[], year, month, onDateClick, onReservationClick
// - 날짜별 예약 블록 표시 (status별 스타일)
// - pending: opacity-60, waiting_deposit: ring-2 ring-orange-400
// - confirmed: solid background
```

**`ReservationModal.tsx` — 예약 신청 모달**
```typescript
'use client'
// shadcn/ui Dialog 사용
// 1단계: 이용수칙 스크롤 + 동의 체크박스
// 2단계: 신청 폼 (실명*, 연락처*, 날짜, 인원)
// 닉네임은 자동 채워짐 (수정 불가)
// POST /api/jeju/reservations
```

**`LikeButton.tsx` — 좋아요 (Optimistic Update)**
```typescript
'use client'
import { useOptimistic } from 'react'
// 클릭 즉시 UI 반영 → 백그라운드로 API 호출
// 실패 시 롤백
```

---

## 7. Tailwind 달콧 팔레트 설정

```javascript
// tailwind.config.ts에 추가
export default {
  theme: {
    extend: {
      colors: {
        dalkkot: {
          'wood-dark':  '#5C3D2E',
          'wood-mid':   '#8B5E3C',
          'wood-light': '#C4956A',
          'cream':      '#FDF6EC',
          'cream-dark': '#F5EAD8',
          'sage':       '#7B9E87',
          'sage-light': '#A8C4B0',
          'sage-dark':  '#4F7C5F',
        }
      }
    }
  }
}
```

### 주요 클래스 패턴

```
헤더:       bg-dalkkot-wood-dark text-dalkkot-cream
페이지 배경: bg-dalkkot-cream
카드:       bg-white border border-dalkkot-cream-dark shadow-sm
버튼(주):   bg-dalkkot-sage-dark text-white hover:bg-dalkkot-sage
배지(확정): bg-green-100 text-green-700
배지(대기): bg-yellow-100 text-yellow-700
배지(입금): bg-orange-100 text-orange-700
배지(반려): bg-red-100 text-red-700
배지(취소): bg-gray-100 text-gray-500
```

---

## 8. 예약 색상 자동 할당

```typescript
// lib/dalkkot/colors.ts
export const RESERVATION_COLORS = [
  '#4CAF50', '#2196F3', '#FF9800', '#9C27B0',
  '#E91E63', '#00BCD4', '#FF5722', '#607D8B'
]

// 신규 예약 시 해당 달에 이미 사용 중인 색상을 제외하고 배정
export function assignColor(usedColors: string[]): string {
  const available = RESERVATION_COLORS.filter(c => !usedColors.includes(c))
  return available.length > 0
    ? available[0]
    : RESERVATION_COLORS[usedColors.length % RESERVATION_COLORS.length]
}
```

---

## 9. 구현 순서 (Phase별)

### Phase 1 — DB 기반 작업 (Day 1)
1. `db/migrations/20260309_01~04.sql` 파일 작성 완료
2. Supabase SQL Editor에서 순서대로 실행
3. `profiles.is_dalkkot_admin = true` 설정
4. `npm run build` 확인 (스키마 변경은 빌드에 무관하지만 타입 확인)

### Phase 2 — 레이아웃 & 라우팅 (Day 1~2)
1. `app/jeju/layout.tsx` — 달콧 독립 레이아웃
2. `_components/DalkkotHeader.tsx` — 5탭 헤더
3. `app/jeju/admin/layout.tsx` — 관리자 인증 가드
4. `tailwind.config.ts` 달콧 팔레트 추가
5. `middleware.ts` `/jeju` 경로 추가

### Phase 3 — 예약 캘린더 (Day 2~4)
1. `GET /api/jeju/reservations` Route Handler
2. `POST /api/jeju/reservations` Route Handler
3. `ReservationCalendar.tsx` 컴포넌트
4. `ReservationModal.tsx` (이용수칙 동의 포함)
5. `app/jeju/calendar/page.tsx`
6. `DELETE /api/jeju/reservations/[id]` (취소)

### Phase 4 — 홈 & 이용수칙 (Day 3~4)
1. `app/jeju/page.tsx` (홈 - Hero + 통계 + 미니캘린더)
2. `GET /api/jeju/villas` Route Handler
3. `app/jeju/info/page.tsx`
4. `PATCH /api/jeju/villas/[id]` (관리자 편집)

### Phase 5 — 맛집 리스트 (Day 4~5)
1. `GET/POST /api/jeju/restaurants` Route Handler
2. likes/comments API
3. `RestaurantCard.tsx`, `LikeButton.tsx`, `CommentSection.tsx`
4. `app/jeju/restaurants/page.tsx`

### Phase 6 — 관리자 패널 (Day 5~6)
1. `PATCH /api/jeju/reservations/[id]/status` (상태 변경)
2. `PATCH /api/jeju/reservations/[id]/meters` (검침값)
3. `AdminReservationTable.tsx` (실명/전화 표시)
4. `app/jeju/admin/page.tsx`
5. `MigrationUploader.tsx` + `POST /api/jeju/admin/migrate`
6. `app/jeju/admin/migrate/page.tsx`

### Phase 7 — 마무리 (Day 6~7)
1. `StatusBadge.tsx`, `StatsCards.tsx` 공통 컴포넌트 정리
2. 모바일 반응형 확인
3. `npm run build` 통과
4. 수동 QA 5개 시나리오 테스트

---

## 11. 예약 히스토리 & 방문 체크 기능 (v3.1 추가)

### 11-1. 기능 개요

| 기능 | 담당자 | 비고 |
|------|--------|------|
| 입장 체크인 | **예약자 본인** | 확정된 예약에만 가능 |
| 퇴실 체크아웃 | **예약자 본인** | 체크인 후에만 가능 |
| 미방문(no_show) 처리 | **관리자** | 퇴실일 지난 후 |
| 현재 사용 중 표시 | 자동 | `visit_status = 'checked_in'` |
| 정산 완료 처리 | **관리자** | 공과금 계산 후 완료 처리 |
| 전체 히스토리 로그 | 자동 | 모든 변경 이벤트 기록 |
| 사용자별 통계 뷰 | 자동 (VIEW) | 관리자 히스토리 페이지용 |

### 11-2. DB 추가 (마이그레이션 041)

**`dalkkot_reservations` 추가 컬럼:**
```sql
visit_status         TEXT  DEFAULT 'not_checked'
                       CHECK (IN: 'not_checked','checked_in','checked_out','no_show')
checked_in_at        TIMESTAMPTZ   -- 실제 입장 시각
checked_out_at       TIMESTAMPTZ   -- 실제 퇴실 시각
settlement_completed BOOLEAN DEFAULT false
settlement_amount    INTEGER       -- 가스비 등 최종 정산 금액 (원)
settlement_notes     TEXT
```

**신규 테이블: `dalkkot_reservation_history`**
```sql
id, reservation_id, actor_id, actor_nickname, actor_role(user/admin/system),
action_type(created/status_changed/checkin/checkout/no_show/
            meters_updated/cancelled/settlement_done),
payload JSONB, created_at
```

**신규 VIEW: `dalkkot_user_stats`**
```sql
닉네임별: 총예약수/확정수/취소수/미방문수/정산완료수/공과금미입력수/최초-최근 이용일
```

**신규 함수: `dalkkot_current_occupant(villa_id?)`**
```sql
현재 check_in ≤ TODAY ≤ check_out 이고 status=confirmed인 예약 반환
```

### 11-3. 체크인/체크아웃 흐름

```
예약 확정(confirmed)
       │
       ▼
[예약자 → 체크인 버튼 클릭]   → visit_status = 'checked_in', checked_in_at = NOW()
       │                          홈/캘린더에 "현재 사용 중" 배지 표시
       ▼
[예약자 → 퇴실 버튼 클릭]    → visit_status = 'checked_out', checked_out_at = NOW()
       │
       ▼
[관리자 → 공과금 검침값 입력]  → gas_meter_in/out, water, elec 입력
       │
       ▼
[관리자 → 정산 완료 처리]     → settlement_completed = true, settlement_amount 기입
```

미방문 흐름:
```
퇴실일 경과 후 visit_status = 'not_checked' 상태
       │
[관리자 → 미방문 처리]        → visit_status = 'no_show'
```

### 11-4. 관리자 히스토리 페이지 (`/jeju/admin/history`)

```
─ [탭: 사용자별 통계] ──────────────────────────────────────
  닉네임 | 총예약 | 확정 | 미방문 | 정산완료 | 공과금미처리 | 최근이용
  빠빠라찌| 8    |  7  |   0   |   7    |     0      | 2025-12

─ [탭: 전체 예약 히스토리] ──────────────────────────────────
  필터: [닉네임 검색] [기간] [상태]
  ┌──────────┬────────┬───────────┬─────────┬───────────────────┐
  │ 닉네임   │ 기간   │ 방문상태 │ 정산    │ 마지막 이벤트      │
  ├──────────┼────────┼──────────┼─────────┼───────────────────┤
  │ 빠빠라찌 │3/7~3/9 │ 체크아웃 │ 완료 ✅ │ 정산완료 2024-03-11│
  │ 잘살자   │4/2~4/5 │ 사용중🟢 │ -      │ 체크인 2026-04-02  │
  │ 지켜보.. │6/1~6/3 │ 미방문   │ -      │ no_show 2024-06-05 │
  └──────────┴────────┴──────────┴─────────┴───────────────────┘

─ [탭: 예약별 이벤트 로그] ──────────────────────── (클릭 시 드릴다운)
  예약 선택 → 해당 예약의 모든 action_type 타임라인 표시
  2024-03-05 10:00 | 잘살자 [user]    | created
  2024-03-05 11:30 | 관리자 [admin]   | status_changed → waiting_deposit
  2024-03-06 09:00 | 관리자 [admin]   | status_changed → confirmed
  2024-03-07 14:22 | 잘살자 [user]    | checkin
  2024-03-09 11:05 | 잘살자 [user]    | checkout
  2024-03-11 09:00 | 관리자 [admin]   | meters_updated
  2024-03-11 09:30 | 관리자 [admin]   | settlement_done {amount: 15600}
```

### 11-5. 추가되는 API 엔드포인트

```
POST /api/jeju/reservations/[id]/visit
  body: { action: 'checkin' | 'checkout' }
  권한: 본인 예약(confirmed 상태)만

PATCH /api/jeju/reservations/[id]/noshow
  권한: 달콧 관리자

PATCH /api/jeju/reservations/[id]/settlement
  body: { amount, notes, completed: true }
  권한: 달콧 관리자

GET /api/jeju/admin/history
  query: { user_id?, date_from?, date_to?, status? }
  권한: 달콧 관리자

GET /api/jeju/admin/history/[reservation_id]/events
  권한: 달콧 관리자
```

### 11-6. 추가 컴포넌트

```
app/jeju/
  _components/
    VisitCheckButtons.tsx      ← 체크인/체크아웃 버튼 (확정 예약자용)
    SettlementForm.tsx         ← 정산 처리 폼 (관리자)
    ReservationTimeline.tsx    ← 예약 이벤트 타임라인
  admin/
    history/
      page.tsx                 ← 예약 히스토리 메인 페이지 (3탭)
```

---

## 10. 완료 기준 (DoD)

| # | 검증 항목 |
|---|-----------|
| 1 | `npm run build` 성공 |
| 2 | 비로그인 → `/jeju` 접근 시 `/login`으로 리다이렉트 |
| 3 | 일반 사용자 → `/jeju/admin` 접근 시 `/jeju`로 리다이렉트 |
| 4 | 예약 신청 → 캘린더에 즉시 반투명 블록 표시 |
| 5 | 동일 날짜 중복 예약 시도 → DB 제약 오류 처리 및 사용자 안내 |
| 6 | 관리자 패널에서 실명/전화 정상 표시, 일반 화면에서 미표시 |
| 7 | pending → waiting_deposit → confirmed 상태 전환 전체 동작 |
| 8 | 맛집 좋아요 클릭 시 즉시 UI 반영 (Optimistic Update) |
| 9 | 댓글 작성/수정/삭제 정상 동작 (본인 댓글만) |
| 10 | CSV 마이그레이션: 날짜 오류 행 표시 + 정상 행 일괄 저장 |
| 11 | 달콧 헤더/레이아웃이 기존 JustGolf 헤더와 완전 분리 |
| 12 | 모바일(375px)에서 캘린더/카드 레이아웃 깨짐 없음 |
| 13 | 예약자 체크인 → 홈 화면에 "현재 사용 중" 배지 즉시 반영 |
| 14 | 관리자 히스토리 페이지 — 사용자별 통계 정상 표시 |
| 15 | 정산 완료 처리 후 히스토리 이벤트 로그에 기록 확인 |
