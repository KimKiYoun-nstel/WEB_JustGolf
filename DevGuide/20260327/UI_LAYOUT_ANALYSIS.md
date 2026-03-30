# UI 레이아웃 현황 분석 및 개선 규칙

> 작성일: 2026-03-27  
> 브랜치: `feature/ui-layout-analysis`  
> 목적: 페이지별 레이아웃 특성 파악 → 공간 낭비 원인 진단 → 레이아웃 규칙 정립

---

## 목차

1. [현황 분석: 페이지 인벤토리](#1-현황-분석-페이지-인벤토리)
2. [공통 패턴 기록](#2-공통-패턴-기록)
3. [공간 낭비 원인 진단](#3-공간-낭비-원인-진단)
4. [페이지 타입 분류](#4-페이지-타입-분류)
5. [레이아웃 규칙 정의](#5-레이아웃-규칙-정의)
6. [페이지별 적용 가이드](#6-페이지별-적용-가이드)
7. [개선 우선순위 체크리스트](#7-개선-우선순위-체크리스트)

---

## 1. 현황 분석: 페이지 인벤토리

### 1-1. 일반 사용자 페이지

| 경로 | 페이지명 | 레이아웃 패턴 | 주요 Wrapper | 공간 낭비도 |
|------|---------|------------|------------|----------|
| `/tournaments` | 대회 목록 | 카드 리스트 | `max-w-5xl px-6 py-14` | ⚠️ 높음 |
| `/t/[id]` | 대회 상세 | 다중 카드 섹션 | 섹션별 카드 | ⚠️⚠️ 매우 높음 |
| `/t/[id]/participants` | 참가자 목록 | 테이블 + ToC | `max-w-5xl` 추정 | 🟡 보통 |
| `/t/[id]/groups` | 조 편성 | 카드 그리드 | 섹션별 | 🟢 낮음 |
| `/t/[id]/draw` | 라이브 추첨 | 애니메이션 + 패널 | 가변 | 🟢 낮음 |
| `/t/[id]/results` | 결과 | 카드 + 테이블 | 서버 컴포넌트 | 🟡 보통 |
| `/t/[id]/status` | 상태 | 미확인 | - | - |
| `/board` | 게시판/피드백 | 카드 리스트 | `max-w-3xl px-6 py-12` | 🟢 낮음 |
| `/profile` | 프로필 | 폼 기반 | `max-w-3xl` 추정 | 🟢 낮음 |
| `/jeju` | 제주(준비 중) | 단일 카드 | `max-w-3xl px-6 py-12` | ⚠️⚠️ 매우 높음 |
| `/login` | 로그인 | 중앙 폼 | 화면 중앙 | 🟢 낮음 |

### 1-2. 관리자 페이지

| 경로 | 페이지명 | 레이아웃 패턴 | 주요 Wrapper | 공간 낭비도 |
|------|---------|------------|------------|----------|
| `/admin` | 관리자 대시보드 | 카드 그리드 (2열) | `max-w-screen-2xl px-3 py-8` | ⚠️⚠️ 매우 높음 |
| `/admin/tournaments` | 대회 관리 목록 | 카드 리스트 | `max-w-6xl px-6 py-8` | 🟡 보통 |
| `/admin/tournaments/new` | 새 대회 생성 | 폼 | - | 🟢 낮음 |
| `/admin/tournaments/[id]` | 대회 상세 레이아웃 | 탭 네비게이션 | 탭 + Sheet | 🟢 낮음 |
| `/admin/tournaments/[id]/dashboard` | 대회 대시보드 | 통계 카드 + 테이블 | `max-w-screen-2xl px-3 py-8` | ⚠️ 높음 |
| `/admin/tournaments/[id]/registrations` | 신청자 관리 | 테이블 중심 | ToC 활용 | 🟢 낮음 |
| `/admin/tournaments/[id]/draw` | 관리자 추첨 | 애니메이션 + 제어판 | 가변 | 🟢 낮음 |
| `/admin/tournaments/[id]/groups` | 조 관리 | 카드 그리드 | - | 🟢 낮음 |
| `/admin/tournaments/[id]/edit` | 대회 수정 | 폼 기반 | - | 🟢 낮음 |
| `/admin/tournaments/[id]/side-events` | 라운드 관리 | 테이블 + 폼 | - | 🟢 낮음 |
| `/admin/tournaments/[id]/extras` | 부가 정보 | 테이블 + 폼 | - | 🟢 낮음 |
| `/admin/tournaments/[id]/files` | 파일 관리 | 목록 | - | - |
| `/admin/users` | 회원 관리 | 통계 카드 + 테이블 | `max-w-screen-2xl px-3 py-8` | 🟡 보통 |
| `/admin/users/[id]` | 회원 상세 | 테이블 정보 | - | 🟢 낮음 |
| `/admin/help` | 도움말 | 문서 뷰어 | - | - |

---

## 2. 공통 패턴 기록

### 2-1. 현재 사용 중인 카드 스타일 (실제 코드 기준)

```
// 관리자 메인 카드
"rounded-[28px] border border-slate-100 bg-white shadow-sm"

// 일반 사용자 대회 목록 카드
"rounded-[30px] border border-transparent bg-white p-6 shadow-sm md:p-8"

// 관리자 대회 목록 내 헤더 섹션
"rounded-[30px] border border-slate-100 bg-white p-6 shadow-sm"

// 통계 미니 카드
"rounded-2xl border border-slate-200 bg-slate-50 p-3"
```

### 2-2. 현재 Wrapper 컨테이너 패턴

```
// 관리자 페이지 (넓음)
"mx-auto flex w-full max-w-screen-2xl flex-col gap-6 px-3 py-8 md:px-4 lg:px-6"

// 관리자 대회 목록
"mx-auto flex w-full max-w-6xl flex-col gap-5"

// 일반 사용자 대회 목록
"mx-auto max-w-5xl px-6 py-14"

// 게시판/제주
"mx-auto max-w-3xl px-6 py-12"
```

### 2-3. 반응형 전환 패턴

| 구간 | Tailwind prefix | 현재 주요 변화 |
|------|----------------|-------------|
| 모바일 (< 768px) | 기본 | 세로 스택, 1열 |
| 태블릿 (≥ 768px) | `md:` | 가로 flex, 2~4열 grid |
| 데스크톱 (≥ 1024px) | `lg:` | px 증가 (px-6) |
| 와이드 (≥ 1280px~) | `xl:`, `2xl:` | max-w-screen-2xl 활용 |

---

## 3. 공간 낭비 원인 진단

### 3-1. 심각도 높음 — 구체적 원인

#### 🔴 관리자 대시보드 (`/admin`)
**문제**: 2열 그리드에 카드 5개. 각 카드는 `CardHeader + CardTitle + CardContent`로 구성되나 내부 정보는 설명문 1~2줄 + 버튼 1개뿐.

```
카드 구조:
  CardHeader: "📅 대회 관리"                     ← title padding 상하 약 24px
  CardContent:
    p: "대회를 생성, 수정, 삭제하고 신청자를 관리합니다."  ← 1줄
    Button: "대회 목록으로"                        ← 1개
```
→ 내용 대비 카드 높이가 2~3배 과도함.  
→ 버튼을 링크 목록으로 교체하거나, 카드를 compact하게 줄여야 함.

#### 🔴 대회 상세 (`/t/[id]`)
**문제**: 단일 페이지에 카드 섹션이 5개 이상 세로로 나열됨. 로그인 안 한 사용자는 대부분 섹션이 비어있어 "등록된 정보가 없습니다" 상태의 카드가 전체 화면을 차지.

#### 🔴 대회 목록 (`/tournaments`)
**문제**: 각 대회 카드에 `p-6 md:p-8` 적용 + 카드 내부에 `gap-5`로 섹션 분리. 대회가 1~2개만 있어도 스크롤 발생.  
카드 내부 정보:
- 상태 뱃지 + 날짜
- 대회명 (2xl font)
- 기본 정보 4줄 (코스/지역/티오프/신청현황)
- 라운드 희망 통계
- 메모
- 사전/사후 라운드 요약 박스 (별도 내부 카드)
- 버튼 2~3개

→ 정보 밀도 자체는 높지만 각 항목의 폰트 크기와 여백이 과도해서 카드 높이가 지나치게 커짐.

#### 🟡 대회 대시보드 (`/admin/tournaments/[id]/dashboard`) 통계 카드
**문제**: `md:grid-cols-4`로 4개 통계 카드 배치는 좋음. 그러나 각 카드가 `CardHeader(pb-3) + CardContent`로 구성되어 숫자 하나를 표시하는 데 높이 120px 이상 소요.  
→ 단순 숫자 표시 카드는 고정 `p-3` 혹은 `p-4` compact 카드로 줄여야 함.

### 3-2. 구조적 문제 패턴 요약

| 패턴 | 문제 | 영향 페이지 |
|------|------|----------|
| CardHeader+CardContent로 단순 버튼 1개 감싸기 | 카드 높이 2~3배 과도 | admin 대시보드 |
| 페이지 y-padding이 `py-14` (56px) | 콘텐츠 적을 때 공백 과도 | 대회 목록, 게시판 |
| 단일 카드 내 정보를 모두 세로 나열 | 가로 공간 미활용 | 대회 목록 카드 내부 |
| 조건부로 표시되는 섹션(미로그인 시 숨겨지는 섹션)도 카드 영역 확보 | 빈 카드 공백 | 대회 상세 |
| 텍스트 크기 h2=text-2xl이 카드 내부 제목에 사용 | 제목이 너무 커서 공간 낭비 | 대회 목록 카드 |
| gap-5~6 (20~24px)을 카드 내부 섹션 구분에 사용 | 내부 여백 과도 | 대부분 카드 |

---

## 4. 페이지 타입 분류

페이지의 특성에 따라 최적 레이아웃 타입을 구분한다.

### Type A — 데이터 목록형 (List/Feed)
> 동일 데이터의 카드/행이 반복되는 페이지

- `/tournaments` (대회 목록)
- `/admin/tournaments` (관리자 대회 목록)
- `/board` (게시판)

**특성**: 항목 수가 가변, 가로/세로 스크롤 없이 탐색 가능해야 함.

### Type B — 상세 정보형 (Detail/Profile)
> 단일 데이터의 다양한 측면을 여러 섹션으로 표시

- `/t/[id]` (대회 상세)
- `/profile` (프로필)
- `/admin/users/[id]` (회원 상세)

**특성**: 섹션이 많아 세로 스크롤은 불가피하나, 섹션 내 정보는 최대한 조밀하게.

### Type C — 대시보드형 (Dashboard/Overview)
> 여러 카테고리의 요약 통계 + 빠른 액션 버튼 배치

- `/admin` (관리자 홈)
- `/admin/tournaments/[id]/dashboard` (대회 대시보드)

**특성**: 한눈에 파악 가능한 밀도, 스크롤 없이 중요 정보 노출.

### Type D — 폼 입력형 (Form/Edit)
> 사용자 입력을 받는 페이지

- `/login` (로그인)
- `/admin/tournaments/new` (새 대회)
- `/admin/tournaments/[id]/edit` (대회 수정)
- `/profile` (프로필 편집)

**특성**: 입력 필드 정렬, 라벨-입력 간격 균일, 모바일 키보드 고려.

### Type E — 테이블 중심형 (Data Table)
> 다수의 행/열 데이터를 표시

- `/t/[id]/participants` (참가자)
- `/admin/tournaments/[id]/registrations` (신청자)
- `/admin/users` (회원 목록)

**특성**: 가로 스크롤 허용, 고정 헤더, 정렬/필터 UI.

### Type F — 특수 인터랙션형 (Special UI)
> 애니메이션, 실시간, 게임성 있는 UI

- `/t/[id]/draw` (라이브 추첨 - 사용자)
- `/admin/tournaments/[id]/draw` (라이브 추첨 - 관리자)

**특성**: 화면 전체 활용, 일반 규칙 예외 적용.

---

## 5. 레이아웃 규칙 정의

### 5-1. 컨테이너 폭 표준

| 컨텍스트 | 권장 max-width | 이유 |
|---------|--------------|------|
| 일반 사용자 (좁은 콘텐츠) | `max-w-3xl` (768px) | 모바일 중심, 집중도 높음 |
| 일반 사용자 (카드 목록) | `max-w-4xl` (896px) | 카드 2열까지 수용 |
| 일반 사용자 (데이터 테이블) | `max-w-5xl` (1024px) | 다수 컬럼 표시 |
| 관리자 (단순 관리) | `max-w-5xl` (1024px) | 통일성 |
| 관리자 (넓은 테이블/대시보드) | `max-w-6xl` (1152px) | 데이터 밀도 |
| 관리자 (와이드 데이터) | `max-w-screen-xl` (1280px) | 초과 방지 |

> `max-w-screen-2xl`은 1536px으로 일반적인 1440px 모니터에서는 거의 풀스크린에 가까움. 와이드 데이터가 아닌 이상 과도한 폭.

### 5-2. 페이지 여백 표준

| 영역 | 현재 | 권장 | 이유 |
|------|------|------|------|
| 페이지 상단 (py-top) | `py-14` (56px) | `py-8` (32px) | 헤더 아래 56px은 과도 |
| 페이지 하단 (py-bottom) | `pb-24` (96px) | `pb-12` (48px) | 모바일 네비 고려해도 96px 과도 |
| 좌우 px (모바일) | `px-6` (24px) | `px-4` (16px) | 좁은 화면에서 24px은 많음 |
| 좌우 px (PC) | `px-6` (24px) | `px-6` (24px) | 유지 |

### 5-3. 카드 패딩 표준

| 카드 타입 | 현재 | 권장 | 이유 |
|---------|------|------|------|
| 일반 콘텐츠 카드 | `p-6 md:p-8` | `p-4 md:p-5` | 내부 여백 50% 감소 |
| 통계/요약 compact 카드 | `CardHeader+CardContent` | `p-3` ~ `p-4` (flat) | 복잡한 Card 컴포넌트 불필요 |
| 대회 목록 아이템 카드 | `p-6 md:p-8` | `p-4 md:p-5` | 항목이 많으면 스크롤 줄여야 |
| 폼 섹션 카드 | `p-6` | `p-4 md:p-5` | 입력 필드는 여백 최소화 |

### 5-4. 카드 내부 간격 표준

| 요소 | 현재 | 권장 |
|------|------|------|
| 카드 내부 섹션 간격 | `gap-5` ~ `gap-6` | `gap-3` ~ `gap-4` |
| 카드 내부 텍스트 줄 간격 | `space-y-3` | `space-y-2` |
| 카드 제목 폰트 | `text-2xl font-bold` | `text-lg font-semibold` |
| 카드 내 서브 제목 | `text-lg` | `text-sm font-semibold` |

### 5-5. 그리드 레이아웃 규칙

#### Type A (목록형) — 카드 배치
```
모바일:  1열 (grid-cols-1)
태블릿:  1열 유지 or 2열 (대회처럼 가로가 유리한 경우)
PC:      2열 (grid-cols-2) — 단, 카드 내 정보가 많으면 1열 유지
```

#### Type C (대시보드형) — 통계 카드
```
모바일:  2열 (grid-cols-2) — 숫자만 표시하는 compact 카드
태블릿:  2~4열
PC:      4열 (grid-cols-4) or 3열 (grid-cols-3)
```

#### Type E (테이블형) — 헤더 통계 + 테이블
```
통계 영역:  모바일 2열, PC 4열 compact 카드
테이블:     overflow-x-auto + min-w-[640px]
```

### 5-6. 반응형 Typography 규칙

| 역할 | 현재 | 권장 |
|------|------|------|
| 페이지 제목 h1 | `text-3xl ~ text-4xl` | `text-2xl md:text-3xl` |
| 카드 제목 | `text-lg ~ text-2xl` | `text-base md:text-lg` |
| 섹션 제목 | `text-lg` | `text-sm font-semibold uppercase tracking-wide text-slate-500` |
| 본문 | `text-sm ~ text-base` | `text-sm` 고정 |
| 보조 텍스트 | `text-xs ~ text-sm` | `text-xs` |

---

## 6. 페이지별 적용 가이드

### 6-1. Type C — 관리자 대시보드 (`/admin`)

**현재 문제**: 카드 5개 각각이 과도하게 큼. 평균 카드 높이 180~200px.

**권장 변환**:
```
[개선 전]
grid gap-4 md:grid-cols-2
Card (rounded-[28px]) → CardHeader + CardContent → 설명 1줄 + 버튼 1개

[개선 후]
1. 상단: 빠른 이동 링크 (단순 링크 버튼 4개, 1줄)
2. 중단: 워크플로우 안내 (현재 amber 카드, compact)
3. 하단: 관련 페이지 바로가기 (grid-cols-2 md:grid-cols-4, 각 compact p-3)
```

**예시 구조**:
```
+---------------------------+
| 👨‍💼 관리자 대시보드         |
| [대회] [회원] [라운드] [조] |  ← 버튼 4개 1줄
+---------------------------+
| 워크플로우 안내 (접힘 가능) |
+---------------------------+
```

### 6-2. Type A — 대회 목록 (`/tournaments`)

**현재 문제**: 카드 1개 높이 350~400px (대회 1개가 화면 절반).

**권장 변환**:
```
[개선 전]
카드: p-6 md:p-8, 제목 text-2xl, 각 정보 개행

[개선 후]
카드: p-4 md:p-5, 제목 text-lg md:text-xl
정보 배치: 2단 grid (코스/지역 | 티오프/신청현황)
버튼: 카드 우측 고정 (md:flex-row 유지)
라운드 요약: 접이식 or 인라인 badge 형태
```

**카드 내부 정보 재배치**:
```
[헤더 row]:  [뱃지] [날짜]                    [내 상태 뱃지]
[제목]:      대회명 (text-lg)
[info grid]: 코스: xxx  | 지역: xxx
             티오프: xxx | 신청: A/B/C/D명
[라운드]:    [사전] 라운드명 ×명  [사후] 라운드명 ×명  ← 인라인
[버튼]:      [상세 보기] [신청 / 취소]
```

### 6-3. Type C — 대회 대시보드 (`/admin/.../dashboard`)

**현재 문제**: 통계 카드 4개가 각각 CardHeader+CardContent로 높이 과도.

**권장 변환**:
```
[개선 전] (각 카드 높이 ~120px)
Card → CardHeader → CardTitle: "전체 신청"
      CardContent → p: "45명"

[개선 후] (각 카드 높이 ~60px)
div.rounded-xl.border.p-3  (flat card)
  p.text-xs.text-slate-500: "전체 신청"
  p.text-2xl.font-bold: "45명"
```

**통계 그리드**:
```
모바일: grid-cols-2 gap-2
PC:     grid-cols-4 gap-3
```

### 6-4. Type B — 대회 상세 (`/t/[id]`)

**현재 문제**: 섹션이 너무 많고 각 섹션이 Card 컴포넌트로 독립적으로 큼.

**권장 변환**:
```
[레이아웃 구조]
모바일: 탭 기반 (주요 섹션만 탭으로)
PC:     2단 레이아웃
  └─ 좌(2/3): 대회 정보 + 신청 폼
  └─ 우(1/3): 내 참가 상태 + 바로가기

[카드 구성]
- 대회 정보 카드: compact (p-4)
- 신청 폼: 고정 하단 sheet 또는 우측 sticky 패널 (PC)
- 라운드 정보: 아코디언 형태
- 참가자 현황: 숫자 요약 badge 1줄
```

### 6-5. Type E — 테이블 페이지 공통

**권장 헤더 통계 구조**:
```tsx
// compact stat cards
<div className="grid grid-cols-2 gap-2 md:grid-cols-4 md:gap-3">
  <div className="rounded-xl border border-slate-200 bg-slate-50 p-3">
    <p className="text-xs font-medium text-slate-500">전체</p>
    <p className="text-xl font-bold text-slate-900">{total}</p>
  </div>
  {/* ... */}
</div>
```

**권장 테이블 래핑**:
```tsx
<div className="overflow-x-auto rounded-2xl border border-slate-200 bg-white">
  <Table className="min-w-[640px]">
    {/* ... */}
  </Table>
</div>
```

---

## 7. 개선 우선순위 체크리스트

### 🔴 즉시 개선 (가장 효과 큼)

- [ ] `/admin` — 대시보드 카드 compact 전환 (CardHeader 제거, flat card 사용)
- [ ] `/admin/tournaments/[id]/dashboard` — 통계 카드 flat으로 전환
- [ ] `/tournaments` — 카드 padding 축소 (`p-6 md:p-8` → `p-4 md:p-5`), 내부 정보 2단 배치
- [ ] 전체 페이지 py 여백 조정 (`py-14` → `py-8`, `pb-24` → `pb-12`)

### 🟡 중기 개선 (UX 향상)

- [ ] `/t/[id]` — PC에서 2단 레이아웃 도입 (대회 정보 좌 / 신청 우)
- [ ] `/t/[id]` — 섹션 탭 또는 아코디언으로 전환하여 초기 화면 단축
- [ ] `/tournaments` — 카드 제목 폰트 축소 (`text-2xl` → `text-lg md:text-xl`)
- [ ] 페이지 좌우 padding 모바일 통일 (`px-6` → `px-4`)

### 🟢 장기 개선 (유지보수성)

- [ ] 공통 compact stat card 컴포넌트 분리 (`StatCard` 등)
- [ ] 대회 목록 카드 컴포넌트 분리 (`TournamentCard`)
- [ ] 전체 페이지에서 사용되는 section wrapper 표준화 (`PageSection`, `PageHeader`)
- [ ] 카드 radius 통일 (`rounded-[28px]` or `rounded-[30px]` → `rounded-2xl` 통일)

---

## 부록 A. 현재 코드에서 발견된 비일관성

| 항목 | 발견된 값들 | 권장 통일값 |
|------|-----------|----------|
| 카드 border-radius | `rounded-[28px]`, `rounded-[30px]`, `rounded-2xl`, `rounded-xl`, `rounded-lg` | `rounded-2xl` (32px) 또는 `rounded-xl` (16px) 2단계만 |
| 페이지 배경색 | `bg-[#F9FAFB]`, `bg-[#F2F4F7]`, `bg-slate-50`, 없음 | `bg-slate-50` 통일 |
| 컨테이너 max-w | `max-w-3xl`, `max-w-4xl`, `max-w-5xl`, `max-w-6xl`, `max-w-screen-2xl` | 5-1절 기준 적용 |
| 카드 shadow | `shadow-sm`, 없음 | `shadow-sm` 통일 |
| 페이지 상단 y-padding | `py-8`, `py-12`, `py-14`, `pb-24` | `py-8 pb-12` 통일 |
| 섹션 gap | `gap-4`, `gap-5`, `gap-6` | `gap-4 md:gap-5` |

---

## 부록 B. 모바일 vs PC 분기 기준

```
모바일 우선 원칙:
1. 기본(no prefix) → 모바일 스타일
2. md:(768px~) → 태블릿/PC 스타일
3. lg:(1024px~) → 와이드 패딩 추가

실용 기준:
- 1열 → 2열 전환: md:grid-cols-2
- flex 방향 전환: md:flex-row
- 숨김/표시: md:hidden / md:block
- 텍스트 크기 전환: md:text-3xl (h1 등)
- 패딩 증가: md:px-6 (기본 px-4에서)
```

---

## 부록 C. 개선 전/후 예상 수치

| 페이지 | 현재 최소 스크롤 높이 (추정) | 개선 후 예상 높이 |
|--------|----------------------|----------------|
| `/admin` | ~900px (5개 큰 카드) | ~400px (compact 링크 + 워크플로우) |
| `/tournaments` (3개 대회) | ~1200px | ~700px |
| `/admin/tournaments/[id]/dashboard` | ~600px | ~400px |
| `/t/[id]` (로그인 상태) | ~1500px+ | ~900px (2단 레이아웃 기준 PC) |

---

*이 문서는 분석 단계의 결과물이며, 실제 개선 작업은 별도 브랜치에서 페이지별로 단계적으로 진행할 것을 권장한다.*
