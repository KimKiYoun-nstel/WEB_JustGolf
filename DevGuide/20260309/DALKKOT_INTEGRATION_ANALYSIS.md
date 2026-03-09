# 달콧 별장 예약 관리 — 현황 분석 및 웹 전환 설계

> 작성일: 2026-03-09  
> 브랜치: `feature-dalkkot`  
> 분석 대상: `RefRepo/dalkkot-main/dalkkot-main/` + 구글 시트 원본 데이터  
> 설계 근거: `RefRepo/Dalkkot_System_Design.md`  
> 연동 목표: `app/jeju/` (현재 "준비 중" 상태 → 완성 예정)

---

## 0. 프로젝트 핵심 목적

> **구글 시트로 관리되던 '달콧' 별장 예약 시스템을  
> JustGolf 웹서비스(Next.js + Supabase + Vercel)에 통합 구현하는 것이 최종 목표.**

`RefRepo/dalkkot-main`은 이 목표를 위해 미리 제작된 **프론트엔드 UI 프로토타입**이며,  
본 문서는 해당 프로토타입과 실제 구글 시트 운영 데이터를 함께 분석하여 구현 방향을 확정한다.

---

## 1. 현행 구글 시트 운영 현황 분석

### 1-1. 시트 구성 (탭 5개)

| 탭명 | 내용 |
|------|------|
| 제주별장달콧이용내역 | **핵심 예약 이력** — 2024년~현재 모든 예약 기록 |
| 이용방법 | 별장 이용 수칙, 비밀번호, 주소, 주의사항 안내 |
| 26년예약일정 | 2026년 예약 전용 시트 (연도별 분리) |
| 25년예약일정 | 2025년 예약 전용 시트 |
| 맛집리스트 | 제주 맛집 공유 목록 |

### 1-2. 실제 예약 데이터 컬럼 구조

```
[입실] | [퇴실] | [이용자] | [가스검침] | [수도검침] | [전기검침] | [비고]
```

| 컬럼 | 형식 | 비고 |
|------|------|------|
| 입실 | 한국식 날짜 (예: `3월7일`) | YYYY-MM-DD 아님 |
| 퇴실 | 한국식 날짜 | 동일 |
| 이용자 | **닉네임** (실명 아님) | 빠빠라찌, 잘살자, 지켜보고있다 등 |
| 가스검침 | 소수점 숫자 | 퇴실 후 후불 정산 근거 |
| 수도검침 | 정수 | 동일 |
| 전기검침 | 소수점 숫자 | 동일 |
| 비고 | 텍스트 | 취소, 확정!, 관계 표시 등 |

### 1-3. 실제 예약 데이터에서 발견된 중요 특징

#### ① 이용자 식별 방식: 닉네임 기반
실명이나 전화번호가 아닌 **닉네임(별명)**으로 이용자를 구분한다.
```
예: 빠빠라찌, 잘살자, 지켜보고있다, 행복해지자구, 나르, 자스민,
    EagleK, 흑형, 내이럴줄알았지, 삼백, 그배, 소요유, 송촌동 등
```
→ 이는 **개인 동호회 지인 네트워크** 기반의 별장임을 명확히 보여줌  
→ 웹서비스에서도 실명 대신 **닉네임(display_name) 기반**으로 설계해야 함

#### ② 공과금 검침값이 핵심 데이터
- 가스/수도/전기 검침값을 **퇴실 시 기록** → 차액으로 공과금 후불 정산
- 일부는 "검침기 고장", "습기로 확인불가" 등 예외 상황도 기록
- 웹서비스에서 **관리자가 검침값을 입력/기록할 수 있어야 함**

#### ③ 명시적 상태 관리 없음 (현행 문제점)
- 현재는 비고란에 `취소`, `확정!` 등 **비정형 텍스트**로 상태 표시
- 예약 신청 → 확정 → 취소 흐름이 단계별로 구조화되어 있지 않음
- → 웹서비스에서 `pending / confirmed / rejected` 상태 분리 필요

#### ④ 인원 수(guests) 컬럼 없음
- 현행 시트에는 예약 인원 수가 기록되지 않음
- 일부 비고에 "(부모님)", "(가족)", "(조카)" 등으로 암묵적 표현만 존재
- → 웹서비스에서 선택적으로 추가 가능한 필드

#### ⑤ 별장 특성
- **단일 villa** (이중 구조: 안거리 / 밖거리 - 보일러 각각 관리)
- 위치: 제주 조천읍 조함해안로 17-7
- "영업하는 집 아니고 동호회지인이 빌려준 것" — 상업적 숙박업 아님
- 비밀번호 공유 방식으로 운영 (대문 / 현관 각각 별도)

#### ⑥ 이용 수칙의 중요성
- 이용방법 탭에 별장 이용 룰이 상세히 기술되어 있음
- 후불 공과금, 셀프청소, 보일러 조작법, 쓰레기 처리 등
- → 웹서비스에서 예약 신청 전 필수 확인 화면(이용 수칙 동의)으로 구현 필요

### 1-4. 현행 방식의 문제점 (전환 필요성)

| 문제 | 현재 상황 | 웹 전환 후 |
|------|-----------|-----------|
| 모바일 가독성 | 구글 시트 모바일 뷰 불편 | 반응형 최적화 UI |
| 예약 신청 절차 | 구두/카톡으로 신청 후 수동 입력 | 온라인 폼으로 직접 신청 |
| 상태 투명성 | 비정형 텍스트로 확인 | `pending/confirmed/rejected` 명확 구분 |
| 공과금 정산 | 수동 검침값 입력/계산 | 검침값 입력 + 자동 차액 계산 |
| 중복 예약 위험 | 동시 수정 시 충돌 가능 | DB 기반 중복 방지 |
| 맛집 정보 | 별도 탭 관리 | 통합 콘텐츠 섹션으로 제공 가능 |

---

## 2. dalkkot-main 프로토타입 분석

### 2-1. 기술 스택

| 구분 | 기술 | 버전 | 역할 |
|------|------|------|------|
| Web Framework | **Hono** | 4.12.5 | 서버 라우팅 + HTML SSR |
| 빌드 | **Vite** | 6.3.5 | 개발 서버 & 프로덕션 번들 |
| 배포 플랫폼 | **Cloudflare Pages** | wrangler 4.4.0 | Edge 배포 |
| 클라이언트 JS | **Vanilla JS** | — | 캘린더/API 호출/모달 |
| CSS | **순수 CSS Variables** | — | 우드+크림+세이지 디자인 시스템 |
| 아이콘 | FontAwesome 6.4.0 | CDN | UI 아이콘 |
| 폰트 | Noto Sans KR | Google CDN | 한국어 최적화 |

**데이터**: 현재 인메모리 Mock 배열 (DB 없음, 서버 재시작 시 초기화)  
→ 구현 목적상 **UI 레이아웃 + 기능 흐름 확인용 프로토타입**이 전부

### 2-2. 구현된 기능 (4개 페이지)

#### `/` 대시보드
- 통계 카드: 전체 예약 수 / 확정 / 대기 중 / 총 예약 인원
- 월별 예약 캘린더 미니뷰 (격자/리스트 전환)
- 최근 예약 목록 테이블 (5건)
- 새 예약 추가 모달

#### `/calendar` 예약 캘린더
- 월별 캘린더 전체 뷰
- 날짜 클릭 → 새 예약 추가 모달
- 예약자별 색상 표시 (`color` 필드)
- 이번 달 예약 목록 전체 테이블

#### `/admin` 관리자 패널
- 대기 중(pending) 예약 목록 + 예약 확정/반려 버튼
- 확정된 예약 목록 조회

#### `/settings` 설정
- 프로필 편집 (이름/연락처/이메일)
- 알림 설정 토글 (UI만, 실제 발송 없음)

### 2-3. API 엔드포인트

| Method | Path | 기능 |
|--------|------|------|
| GET | `/api/reservations` | 전체 예약 목록 |
| GET | `/api/reservations/:id` | 예약 단건 조회 |
| POST | `/api/reservations` | 새 예약 생성 |
| PATCH | `/api/reservations/:id/status` | 상태 변경 |
| DELETE | `/api/reservations/:id` | 예약 삭제 |

### 2-4. 프로토타입 Mock 데이터 모델

```typescript
// 현재 프로토타입 모델
interface Reservation {
  id: string
  user_name: string       // 예약자명
  phone: string           // 연락처
  check_in: string        // 'YYYY-MM-DD'
  check_out: string       // 'YYYY-MM-DD'
  guests: number          // 예약 인원
  status: 'confirmed' | 'pending' | 'rejected'
  notes?: string
  color?: string          // 캘린더 표시 색상
  created_at: string
}
```

**⚠️ 실제 구글 시트와의 차이점:**
- `phone` 필드: 시트에 없음 (지인 네트워크이므로 닉네임으로 충분)
- `guests` 필드: 시트에 없음 (선택적 추가 가능)
- `user_name`: 실명이 아닌 **닉네임**이어야 함
- `가스/수도/전기 검침값`: 프로토타입에 없음 → **웹서비스에 추가 필요**

### 2-5. 디자인 시스템 (재사용 가치 높음)

자연/전원 컨셉의 우드+크림+세이지 팔레트:

```css
--wood-dark:  #5C3D2E   /* 헤더/내비게이션 배경 */
--wood-mid:   #8B5E3C
--wood-light: #C4956A
--cream:      #FDF6EC   /* 페이지 배경 */
--sage:       #7B9E87   /* 포인트 색상 */
--sage-dark:  #4F7C5F
```

→ Tailwind config에 커스텀 색상으로 이식 가능  
→ 제주 별장 감성에 일치하는 UI 톤앤매너

---

## 3. 웹 전환 설계 (구현 목표)

### 3-1. 최종 아키텍처

```
JustGolf (Next.js App Router)
└── app/jeju/
    ├── page.tsx              ← 대시보드 (공유 캘린더 + 내 예약 현황)
    ├── calendar/page.tsx     ← 캘린더 전체 뷰 (로그인 사용자 전용)
    ├── admin/page.tsx        ← 관리자 패널 (is_admin 전용)
    ├── settings/page.tsx     ← 이용 수칙 + 알림 설정
    └── _components/          ← 공유 컴포넌트

app/api/jeju/
└── reservations/
    ├── route.ts              ← GET / POST
    └── [id]/
        ├── route.ts          ← GET / DELETE
        └── status/route.ts   ← PATCH

Supabase
├── reservations 테이블 (RLS 적용)
└── villas 테이블 (이용 수칙 등)
```

### 3-2. DB 스키마 설계

#### `villas` 테이블

```sql
CREATE TABLE villas (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name        TEXT NOT NULL,           -- '달콧'
  description TEXT,                   -- Markdown 지원 (이용 수칙)
  rules       TEXT,                   -- 주의사항 (Markdown)
  address     TEXT,                   -- '제주 조천읍 조함해안로 17-7'
  is_active   BOOLEAN DEFAULT true,
  created_at  TIMESTAMPTZ DEFAULT NOW()
);
```

#### `reservations` 테이블

```sql
CREATE TABLE reservations (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  villa_id        UUID REFERENCES villas(id) ON DELETE CASCADE,
  user_id         UUID REFERENCES auth.users(id),
  display_name    TEXT NOT NULL,              -- 닉네임 (공유 표시용)
  check_in        DATE NOT NULL,
  check_out       DATE NOT NULL,
  status          TEXT NOT NULL DEFAULT 'pending'
                    CHECK (status IN ('pending', 'confirmed', 'rejected')),
  guests          INTEGER,                    -- 선택적
  notes           TEXT,                       -- 비고/요청사항
  color           TEXT DEFAULT '#4CAF50',     -- 캘린더 표시 색상
  -- 공과금 검침값 (관리자 입력)
  gas_meter_in    NUMERIC,                    -- 입실 시 가스 검침
  gas_meter_out   NUMERIC,                    -- 퇴실 시 가스 검침
  water_meter_in  NUMERIC,                    -- 수도 검침
  water_meter_out NUMERIC,
  elec_meter_in   NUMERIC,                    -- 전기 검침
  elec_meter_out  NUMERIC,
  meter_notes     TEXT,                       -- 검침 특이사항 (고장 등)
  created_at      TIMESTAMPTZ DEFAULT NOW(),
  updated_at      TIMESTAMPTZ DEFAULT NOW(),
  CONSTRAINT no_overlap EXCLUDE USING gist (
    villa_id WITH =,
    daterange(check_in, check_out, '[)') WITH &&
  ) WHERE (status != 'rejected')              -- 거절 건 제외하고 중복 방지
);
```

> **중복 예약 방지**: PostgreSQL `EXCLUDE` 제약 + `daterange` gist 인덱스로  
> 같은 별장에 날짜 겹치는 예약(rejected 제외) 자동 차단

### 3-3. RLS 정책 설계

```sql
-- 이용자 간 투명한 공유 문화: 로그인 사용자는 전체 조회 가능
CREATE POLICY "로그인 사용자 전체 조회"
  ON reservations FOR SELECT
  USING (auth.uid() IS NOT NULL);

-- 본인 예약만 생성
CREATE POLICY "본인 예약 생성"
  ON reservations FOR INSERT
  WITH CHECK (auth.uid() = user_id);

-- pending 상태의 본인 예약만 수정/삭제
CREATE POLICY "본인 pending 예약 수정"
  ON reservations FOR UPDATE
  USING (auth.uid() = user_id AND status = 'pending');

CREATE POLICY "본인 pending 예약 삭제"
  ON reservations FOR DELETE
  USING (auth.uid() = user_id AND status = 'pending');

-- 관리자: 모든 예약 상태 변경 + 검침값 입력
CREATE POLICY "관리자 전체 수정"
  ON reservations FOR UPDATE
  USING (
    EXISTS (
      SELECT 1 FROM profiles
      WHERE id = auth.uid() AND is_admin = true
    )
  );
```

**3케이스 권한 요약**:
| 케이스 | 조회 | 생성 | 상태 변경 | 검침값 입력 |
|--------|------|------|-----------|------------|
| 비로그인 | ❌ | ❌ | ❌ | ❌ |
| 일반 사용자 | ✅ (전체) | ✅ (본인) | ✅ (본인 pending) | ❌ |
| 관리자(is_admin) | ✅ | ✅ | ✅ | ✅ |

### 3-4. 사용자 흐름

```
1. 로그인 (/jeju 진입 시 로그인 필수)
       ↓
2. 공유 캘린더 확인 (타인 예약 닉네임+날짜 조회)
       ↓
3. 빈 날짜 선택 → 예약 신청 폼 (이용 수칙 동의 포함)
       ↓
4. 신청 저장 → status: 'pending' (캘린더에 즉시 표시)
       ↓
5. 관리자 대시보드에서 신청 검토 → [확정] 또는 [반려]
       ↓
6. status: 'confirmed' → 캘린더 색상 변경 (확정 표시)
       ↓
7. 퇴실 후 관리자가 공과금 검침값 입력 → 정산 근거 기록
```

### 3-5. 공과금 정산 기능 (현행 시트의 핵심 기능 → 웹 전환 필수)

```
정산 금액 자동 계산:
- 가스 사용량 = gas_meter_out - gas_meter_in  (단위: m³, 5200원/1m³)
- 수도 사용량 = water_meter_out - water_meter_in
- 전기 사용량 = elec_meter_out - elec_meter_in  (kWh)
```

관리자 패널에서 검침값 입력 시 자동 계산 표시 → 정산 정보 이메일/카톡 발송 연동 가능

---

## 4. 파일 구조 계획

```
app/jeju/
  page.tsx                      ← 대시보드 (캘린더 미니뷰 + 내 예약 목록)
  calendar/
    page.tsx                    ← 월별 캘린더 전체 뷰
  admin/
    page.tsx                    ← 관리자 패널 (신청 승인/반려 + 검침값 입력)
  settings/
    page.tsx                    ← 이용 수칙 + 알림 설정
  _components/
    ReservationCalendar.tsx     ← 캘린더 (Vanilla JS 로직 → React 이식)
    ReservationModal.tsx        ← 예약 신청/상세 모달
    ReservationForm.tsx         ← 예약 신청 폼 (이용 수칙 동의 포함)
    StatsCards.tsx              ← 통계 카드 4종
    ReservationTable.tsx        ← 예약 목록 테이블
    MeterForm.tsx               ← 공과금 검침값 입력 폼 (관리자용)
    UtilityCalcDisplay.tsx      ← 공과금 자동 계산 표시

app/api/jeju/
  reservations/
    route.ts                    ← GET(목록/필터), POST(신청)
    [id]/
      route.ts                  ← GET(상세), DELETE(취소)
      status/
        route.ts                ← PATCH(확정/반려) - 관리자 전용
      meters/
        route.ts                ← PATCH(검침값 입력) - 관리자 전용

db/migrations/
  20260309_dalkkot.sql          ← villas, reservations 테이블 + RLS
```

---

## 5. 프로토타입(dalkkot-main) 재사용 자산

| 자산 | 재사용 방법 |
|------|------------|
| **디자인 시스템** (CSS Variables) | Tailwind `theme.extend.colors`에 `wood`, `sage`, `cream` 팔레트 추가 |
| **캘린더 렌더링 로직** (`buildCalendarHTML`) | React 컴포넌트로 이식 (날짜 계산/예약 색상 표시 로직 그대로 활용) |
| **4개 페이지 레이아웃** | shadcn/ui Card/Table/Dialog로 동일 구조 재현 |
| **Reservation 모델** | Supabase 테이블 스키마로 확장 (검침값 필드 추가) |
| **상태 레이블 함수** | `lib/statusLabels.ts`에 통합 (이미 유사 패턴 존재) |
| **모달 패턴** | shadcn/ui `Dialog` 컴포넌트로 대체 |

---

## 6. 현재 `app/jeju/page.tsx` 상태

```tsx
// 현재: "준비 중" 안내 카드만 있는 빈 페이지
export default function JejuPage() {
  return (
    <Card>
      <CardTitle>제주달콧</CardTitle>
      <CardDescription>준비 중인 페이지입니다.</CardDescription>
      <Button asChild variant="outline">
        <Link href="/start">메인화면으로 돌아가기</Link>
      </Button>
    </Card>
  )
}
```

→ 이 파일부터 시작하여 단계적으로 완성

---

## 7. 기대 효과 (설계서 기준)

| 측면 | 효과 |
|------|------|
| **투명성** | 로그인 사용자 간 닉네임+일정 실시간 공유 → 자율적 예약 문화 |
| **편의성** | 시트 수동 입력 대비 예약 신청/확정 시간 대폭 단축 |
| **공과금 관리** | 검침값 자동 차액 계산 → 정산 오류 방지 |
| **중복 방지** | DB 제약으로 동시 중복 예약 원천 차단 |
| **확장성** | 맛집 리스트 탭 → 웹서비스 콘텐츠 섹션으로 통합 가능 |

---

## 8. 구현 착수 체크리스트

### Phase 1 — DB & 인프라
- [ ] `db/migrations/20260309_dalkkot.sql` 작성 및 Supabase SQL Editor 실행
- [ ] RLS 정책 3케이스 검증 (관리자/일반/비로그인)
- [ ] `villas` 테이블에 달콧 초기 데이터 삽입

### Phase 2 — API Route Handler
- [ ] `GET /api/jeju/reservations` — 월별 필터링 포함
- [ ] `POST /api/jeju/reservations` — 중복 날짜 검증
- [ ] `PATCH /api/jeju/reservations/[id]/status` — 관리자 인증 가드
- [ ] `PATCH /api/jeju/reservations/[id]/meters` — 검침값 입력

### Phase 3 — UI 컴포넌트
- [ ] Tailwind config에 달콧 컬러 팔레트 추가
- [ ] `ReservationCalendar` 컴포넌트 (월별 캘린더, 예약 색상 표시)
- [ ] `ReservationModal` (예약 신청 + 이용 수칙 동의 체크)
- [ ] `MeterForm` (관리자용 검침값 입력 + 자동 계산)

### Phase 4 — 페이지 구현
- [ ] `app/jeju/page.tsx` — 대시보드 (통계 + 캘린더 미니뷰 + 내 예약)
- [ ] `app/jeju/calendar/page.tsx` — 전체 캘린더 뷰
- [ ] `app/jeju/admin/page.tsx` — 관리자 패널
- [ ] `app/jeju/settings/page.tsx` — 이용 수칙 표시

### 완료 조건 (DoD)
- [ ] `npm run build` 성공
- [ ] 중복 예약 차단 확인 (동일 날짜 2건 시도)
- [ ] RLS 정책 — 비로그인 차단, 타인 예약 수정 불가, 관리자 전용 기능 검증
- [ ] 공과금 검침값 입력 → 계산 표시 확인
- [ ] 모바일 레이아웃 확인

---

## 9. 리스크 및 주의사항

| 리스크 | 대응 방안 |
|--------|-----------|
| 비밀번호/민감 정보 (대문/현관 비번) | 웹서비스에 포함 금지 — 별도 채널(카톡 등)로만 공유 |
| 닉네임 중복 가능성 | `profiles` 테이블의 `display_name` unique 제약 검토 |
| 구글 시트 기존 데이터 마이그레이션 | CSV 추출 → 날짜 포맷 정규화(YYYY-MM-DD) → supabase import |
| 단일 villa 가정 깨질 경우 | `villa_id` FK 구조로 다중 villa 확장 용이 |
| 공과금 단가 변동 | 하드코딩 금지 — `villa_settings` 또는 상수 파일로 관리 |
