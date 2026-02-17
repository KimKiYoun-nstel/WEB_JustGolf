# UX 개선 분석 및 전략 (2026-02-16)

## 📋 목차
1. [분석 개요](#분석-개요)
2. [현재 상태 분석](#현재-상태-분석)
3. [햄버거 메뉴 적용 가능 지점](#햄버거-메뉴-적용-가능-지점)
4. [앵커 메뉴 적용 가능 지점](#앵커-메뉴-적용-가능-지점)
5. [PC vs 모바일 UX 전략](#pc-vs-모바일-ux-전략)
6. [추천 구현 순서](#추천-구현-순서)
7. [기술 구현 사항](#기술-구현-사항)

---

## 분석 개요

### 목표
- PC & 모바일 모두에서 최적화된 사용자 경험 제공
- 네비게이션 복잡도 감소
- 모바일 화면에서의 가독성 및 접근성 개선
- 관리자 대시보드 효율성 증대

### 분석 대상
- **Header 네비게이션** (모든 사용자)
- **관리자 대시보드** (로그인한 관리자)
- **대회 상세 페이지** (일반 사용자)
- **관리자 숨고 기능 페이지들**

---

## 현재 상태 분석

### 1. Header.tsx (공통)
**문제점:**
- 모바일에서 네비게이션 버튼들이 가로로 배열되어 화면 공간 낭비
- 닉네임과 여러 버튼(홈/관리자, 프로필, 로그아웃)이 한 줄에 표시되어 줄바꿈 발생

**현재 구조:**
```
PC:  ⛳ Just Golf │ 닉네임님 │ 홈 │ 내프로필 │ 로그아웃

모바일:  ⛳ Just Golf │ 닉네임님
          홈 │ 내 프로필 │ 로그아웃
          (또는 더 복잡하게 줄바꿈)
```

### 2. AdminLayout (관리자 전용)
**문제점:**
- 3개의 메인 네비게이션 버튼이 가로 배열
- 모바일에서는 줄바꿈으로 인해 상당한 공간 차지

**현재 구조:**
```
┌──────────────────────────┐
│ 홈 │ 대시보드 │ 대회 관리 │
└──────────────────────────┘
```

### 3. Admin Tournament 서브페이지들
**문제점:**
- 10개의 독립적인 관리 페이지(`/admin/tournaments/[id]/...`)가 존재
- 각 페이지에서 다른 섹션으로 이동할 때 명확한 네비게이션 경로 부재
- 사용자가 어느 페이지에 있는지, 다음 단계가 뭔지 불명확

**현재 구조:**
```
/admin/tournaments/[id]/dashboard      (대회 현황)
/admin/tournaments/[id]/edit           (대회 정보 수정)
/admin/tournaments/[id]/registrations  (신청자 관리)
/admin/tournaments/[id]/side-events    (라운드 관리)
/admin/tournaments/[id]/extras         (활동 관리)
/admin/tournaments/[id]/meal-options   (메뉴 관리)
/admin/tournaments/[id]/groups         (조편성)
/admin/tournaments/[id]/files          (파일 관리)
/admin/tournaments/[id]/manager-setup  (관리자 권한)
/admin/tournaments/[id]/draw           (티타임 배정)
```

### 4. 긴 페이지들
**문제점:**
- `/t/[id]/page.tsx`: 2,120줄 - 대회 상세 정보 + 여러 탭 콘텐츠가 한 페이지에 혼합
- 스크롤이 많아서 원하는 섹션을 찾기 어려움
- 모바일에서는 더욱 심함

---

## 햄버거 메뉴 적용 가능 지점

### 1. Header.tsx - 🔴 **최우선** (모든 사용자 영향)

**현재:**
```
┌─────────────────────────────────────────────┐
│ ⛳ Just Golf │ 닉네임님║홈│내프로필│로그아웃│
└─────────────────────────────────────────────┘

모바일에서 줄바꿈 문제
```

**개선 안:**
```
PC (≥768px):
┌─────────────────────────────────────────────┐
│ ⛳ Just Golf │ 닉네임님║홈│내프로필│로그아웃│
└─────────────────────────────────────────────┘

모바일 (<768px):
┌──────────────────────────┐
│ ⛳ Just Golf         ≡    │
├──────────────────────────┤
│ 👤 닉네임님                │
│ ├ 🏠 홈                   │
│ ├ 👥 내 프로필            │
│ └ 🚪 로그아웃             │
└──────────────────────────┘
```

**구현 대상:**
- 모바일: 햄버거 아이콘 (≡) 클릭 시 드롭다운/드로어 메뉴
- 데스크톱: 기존 가로 배열 유지
- 반응형 분기점: `md` (768px)

**파일:**
- `components/Header.tsx` 수정
- `components/ui/` 추가 컴포넌트 필요 가능 (Sheet 등)

---

### 2. AdminLayout - 🟡 **중간 우선** (관리자)

**현재:**
```
┌──────────────────────────┐
│ 홈 │ 대시보드 │ 대회 관리 │
└──────────────────────────┘
```

**개선 안:**
```
PC (≥1024px):
┌────────────────────┐
│ 🏠 홈              │
│ 📊 대시보드         │
│ 📋 대회 관리        │
└────────────────────┘
(사이드바 또는 탭)

모바일 (<1024px):
┌──────────────────────────┐
│ ⛳ Golf Admin       ≡     │
├──────────────────────────┤
│ 🏠 홈                     │
│ 📊 대시보드               │
│ 📋 대회 관리              │
└──────────────────────────┘
```

**파일:**
- `app/admin/layout.tsx` 수정

---

### 3. Admin Tournament [id] 서브네비 - 🔴 **최우선** (관리자 효율성)

**현재:**
- 각 페이지에서 개별적으로 "뒤로가기" 또는 수동 네비게이션

**개선 안 (새로운 Layout 파일):**

`app/admin/tournaments/[id]/layout.tsx` 생성

```
PC (≥1024px):
┌─────────────────────────────────────────┐
│ 대회이름: 2026 Spring Golf Tour   ≡    │
├─────────────────────────────────────────┤
│ 📊   🎯   ✏️   🎪   📁   🧩   👥  │ (탭)
│ 현황  배정  수정  활동  파일  조   관리자
│ 🍽️   ✅   🎬                        │
│ 메뉴  신청자 라운드                   │
├─────────────────────────────────────────┤
│ [페이지 콘텐츠]                        │
└─────────────────────────────────────────┘

모바일 (<1024px):
┌──────────────────────────────┐
│ 대회이름             ≡       │
├──────────────────────────────┤
│ 📊 현황   🎯 배정   ✏️ 수정  │
│ 🎪 활동   📁 파일   🧩 조    │
│ 👥 관리자 🍽️ 메뉴  ✅ 신청자 │
│ 🎬 라운드                    │
├──────────────────────────────┤
│ [페이지 콘텐츠]              │
└──────────────────────────────┘
```

**탭 메뉴 항목 (10개):**
1. 📊 현황 (dashboard)
2. 🎯 배정 (draw) - 티타임 배정
3. ✏️ 수정 (edit)
4. 🎪 활동 (extras)
5. 📁 파일 (files)
6. 🧩 조 (groups)
7. 👥 관리자 (manager-setup)
8. 🍽️ 메뉴 (meal-options)
9. ✅ 신청자 (registrations)
10. 🎬 라운드 (side-events)

**구현 방식:**
- 새로운 `layout.tsx` 파일 생성
- 탭 컴포넌트 (다른 라우트로 이동)
- 현재 경로에 따라 활성 탭 하이라이트
- 모바일: 스크롤 가능한 수평 탭 또는 하단 스크롤

---

## 앵커 메뉴 적용 가능 지점

### 1. 대회 상세 페이지 - 🔴 **최우선** (`/t/[id]/page.tsx`)

**문제:**
- 2,120줄의 매우 긴 페이지
- 모바일 사용자가 원하는 섹션을 찾기 매우 어려움
- 스크롤 거리가 많음

**현재 추정 섹션 구조:**
```
1. 대회 기본 정보 (제목, 날짜, 코스, 시간)
2. 토너먼트 라운드 신청
   - 신청 상태
   - 식사 선택
   - 숙박 선택 (있으면)
   - 메모
3. 사전 라운드들 (Pre-round)
   - 각 라운드별 신청 상태
   - 식사 선택
   - 숙박 선택
4. 사후 라운드들 (Post-round)
   - 각 라운드별 신청 상태
   - 식사 선택
   - 숙박 선택
5. 활동 목록 (Activities/Extras)
6. 활동 선택 현황
7. 조편성 정보 (그룹 배정)
8. 파일 다운로드 (조편성표, 안내문 등)
```

**개선 안:**

```
모바일:
┌─────────────────────────────┐
│ 2026 Spring Golf Tour        │
├─────────────────────────────┤
│ 📑 목차                      │
│ ├ 📌 대회정보                │
│ ├ 🎮 토너먼트               │
│ ├ 🌅 사전라운드              │
│ ├ 🌆 사후라운드              │
│ ├ 🎪 활동별선택             │
│ ├ 🧩조편성                  │
│ └ 📥 파일                   │
│ [모달/드로어로 펼쳐짐]       │
├─────────────────────────────┤
│ 📌 대회정보                  │
│ [해당 섹션 콘텐츠]           │
│ ...                          │
│ [클릭 시 다음 섹션으로]      │
└─────────────────────────────┘

PC:
┌────────────────────────────────────┐
│ 2026 Spring Golf Tour │ 📑목차    │
├────────────────────────────┬────────┤
│ 📌 대회정보                 │📌대회  │
│ [콘텐츠]                   │🎮토토 │
│ ─────────────────────────  │🌅사전 │
│ 🎮 토너먼트                 │🌆사후 │
│ [콘텐츠]                   │🎪활동 │
│ ...                        │🧩조편 │
│                            │📥파일 │
│                            │      │
└────────────────────────────┴────────┘
(우측에 고정 목차)
```

**구현 방식:**
- 섹션별 `id` 속성 추가 (예: `id="tournament-info"`)
- 모바일: 상단에 목차 메뉴 (드롭다운/모달)
- PC: 우측 고정 사이드바
- `window.scrollTo()` 또는 HTML `<a href="#section">` 점프

**파일:**
- `app/t/[id]/page.tsx` 리팩토링
- 새 컴포넌트: `components/TableOfContents.tsx`

---

### 2. 신청자 관리 페이지 - 🟡 **중간** (`/admin/tournaments/[id]/registrations`)

**현재:**
- 신청자 테이블이 길어짐 (많은 신청자)
- 상태별 필터 필요

**개선 안:**
```
┌──────────────────────────────┐
│ ✅신청자 관리                  │
├──────────────────────────────┤
│ [필터] 전체│신청│승인│대기│취소 │
│ [목차] 신청(5) > 승인(12) > ... │
├──────────────────────────────┤
│ 📋 신청 (5명)                │
│ ├ 홍길동 (2026-01-15)        │
│ ├ 김영희 ...                 │
│ ...                          │
├──────────────────────────────┤
│ ✅ 승인 (12명)               │
│ ├ 이순신 ...                 │
│ ...                          │
└──────────────────────────────┘
```

**구현 방식:**
- 상태별 탭 또는 필터
- 각 섹션에 `id` 추가
- 앞서 로드시 각 섹션으로 점프

---

### 3. 라운드 관리 페이지 - 🟡 **중간** (`/admin/tournaments/[id]/side-events`)

**현재:**
- 사전/사후 라운드가 섞여있음
- 라운드가 여러 개면 목록이 길어짐

**개선 안:**
```
┌──────────────────────────┐
│ 🎬 라운드 관리            │
├──────────────────────────┤
│ 📑 목차                  │
│ ├ 🌅 사전라운드           │
│ │  ├ Round1             │
│ │  └ Round2             │
│ └ 🌆 사후라운드           │
│    ├ 친선경기             │
│    └ 골프존               │
├──────────────────────────┤
│ 🌅 사전라운드             │
│ ├─ Round1              │
│ │  [라운드상세/신청현황]   │
│ ├─ Round2              │
│ ...                    │
└──────────────────────────┘
```

**구현 방식:**
- 라운드 타입별(`pre`/`post`) 섹션 분류
- 각 라운드에 `id` 추가
- 목차에서 라운드별 점프 가능

---

### 4. 조편성 관리 페이지 - 🟡 **중간** (`/admin/tournaments/[id]/groups`)

**현재:**
- 모든 조가 펼쳐져 있음
- 조가 많으면 스크롤이 많음

**개선 안:**
```
┌──────────────────────────┐
│ 🧩 조편성                │
├──────────────────────────┤
│ ▼ 1조 (4명)              │ ◄─ 아코디언
│ ├ 홍길동 (Handicap: 5)  │    (클릭으로
│ ├ 김영희 ...             │     펼치고
│ ├ 이순신 ...             │     닫음)
│ └ 강감찬 ...             │
│ ▶ 2조 (4명)              │
│ ▶ 3조 (3명)              │
│ ...                      │
└──────────────────────────┘
```

**구현 방식:**
- 기존 테이블 구조를 아코디언으로 변경
- 각 조를 클릭 시 펼쳐짐/닫힘
- 초기 로드: 닫힌 상태로 (성능)

---

## PC vs 모바일 UX 전략

### 반응형 디자인 기준

| 구성요소 | 모바일 (<768px) | 태블릿 (768px~1024px) | 데스크톱 (≥1024px) |
|---------|-----------------|----------------------|-------------------|
| **Header** | 햄버거 메뉴 | 혼합 (버튼 일부/메뉴) | 가로 네비게이션 |
| **Admin 메인 네비** | 햄버거 | 햄버거 + 탭 | 탭 또는 사이드바 |
| **Admin [id] 서브** | 햄버거 + 스크롤탭 | 수평탭 | 수평탭 + 아이콘 |
| **앵커 메뉴** | 상단 드로어 | 상단 드롭다운 | 우측 고정사이드바 |
| **테이블/리스트** | 아코디언 또는 카드 | 축소된 테이블 | 전체 테이블 |
| **폰트/간격** | 작음, 촘촘 | 중간 | 넉넉함 |

### 구체적 구현 가이드

#### 모바일 우선 설계 (Mobile-First)
1. 기본 모바일 레이아웃 구현
2. `md` (768px) 이상: 추가 요소 표시/변경
3. `lg` (1024px) 이상: 완전한 데스크톱 레이아웃

#### Tailwind Breakpoints
```
sm:   640px
md:   768px
lg:   1024px
xl:   1280px
2xl:  1536px
```

---

## 추천 구현 순서

### Phase 1 - 기초 (1주)
**영향도 최대, 난이도 낮음**

1. **Header 햄버거 메뉴** (모든 사용자 영향)
   - 파일: `components/Header.tsx`
   - 예상 소요시간: 2-3시간
   - 필요 요소: Sheet/Dropdown 컴포넌트

2. **AdminLayout 햄버거** (관리자 기본)
   - 파일: `app/admin/layout.tsx`
   - 예상 소요시간: 1-2시간
   - 기존 레이아웃 개선

### Phase 2 - 중점 (1.5주)
**관리자 대시보드 UX 대폭 개선**

3. **Admin Tournament [id] Layout 생성** (관리자 효율성 증가)
   - 새 파일: `app/admin/tournaments/[id]/layout.tsx`
   - 예상 소요시간: 4-5시간
   - 10개 서브페이지 통합 네비게이션

4. **대회 상세 페이지 앵커 메뉴** (사용자 UX)
   - 파일: `app/t/[id]/page.tsx` 리팩토링
   - 새 컴포넌트: `components/TableOfContents.tsx`
   - 예상 소요시간: 4-5시간
   - 섹션별 ID 추가, 목차 컴포넌트

### Phase 3 - 보완 (1주)
**관리자 페이지 추가 개선**

5. **Registrations 영역 분류 + 앵커**
   - 파일: `app/admin/tournaments/[id]/registrations/page.tsx`
   - 예상 소요시간: 2-3시간

6. **Side-Events 섹션 분류 + 앵커**
   - 파일: `app/admin/tournaments/[id]/side-events/page.tsx`
   - 예상 소요시간: 2-3시간

7. **Groups 아코디언 변경**
   - 파일: `app/admin/tournaments/[id]/groups/page.tsx`
   - 예상 소요시간: 3-4시간

### Phase 4 - 미세조정 (1주)
**테스트 및 최적화**

8. **반응형 테스트 및 브라우저 호환성**
   - 예상 소요시간: 3-4시간

9. **성능 최적화** (마이크로 인터랙션, 번들 크기)
   - 예상 소요시간: 2-3시간

---

## 기술 구현 사항

### 필수 UI 컴포넌트
```javascript
// 기존 또는 추가 필요
components/ui/
├── button.tsx           (기존)
├── sheet.tsx            (New - 모바일 드로어)
├── tabs.tsx             (기존 또는 New)
├── dropdown-menu.tsx    (New)
├── accordion.tsx        (New - 아코디언)
└── table-of-contents.tsx (New - 앵커 메뉴)
```

### 새로운 파일 생성 예상
```
app/
├── admin/
│   └── tournaments/
│       └── [id]/
│           └── layout.tsx (NEW)
│
└── t/
    └── [id]/
        └── components/
            ├── SectionInfo.tsx
            ├── SectionPreRound.tsx
            ├── SectionPostRound.tsx
            ├── SectionActivities.tsx
            ├── SectionGroups.tsx
            └── SectionFiles.tsx

components/
├── MobileMenu.tsx (NEW)
├── AdminNavTabs.tsx (NEW)
├── TableOfContents.tsx (NEW)
└── ...
```

### CSS/Tailwind 고려사항
```tailwind
/* 모바일 사이드 패딩 */
px-4 md:px-6 lg:px-8

/* 숨김 관리 */
hidden md:block      (데스크톱에서만 보임)
md:hidden            (모바일에서만 보임)

/* 플렉스 방향 */
flex-col md:flex-row (모바일: 세로, 데스크톱: 가로)

/* 높이/오버플로우 */
max-h-[calc(100vh-60px)]  (헤더 제외 전체 높이)
overflow-y-auto            (스크롤 가능)
```

### 성능 최적화
- **Code Splitting**: 각 섹션을 별도 컴포넌트로 분리
- **Lazy Loading**: 필요시 섹션별 동적 로드
- **Memoization**: 탭/메뉴 변경 시 불필요한 리렌더링 방지
- **Intersection Observer**: 앵커 메뉴 자동 업데이트

---

## 구현 예시 코드 스켈레톤

### 1. Header 햄버거 메뉴 기본 구조
```tsx
// components/Header.tsx - 개선된 버전 (스켈레톤)

export default function Header() {
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);

  return (
    <header>
      {/* PC 네비게이션 */}
      <nav className="hidden md:flex gap-2">
        {/* 기존 버튼들 */}
      </nav>

      {/* 모바일 햄버거 */}
      <button 
        className="md:hidden"
        onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
      >
        ≡
      </button>

      {/* 모바일 드로어 메뉴 */}
      {mobileMenuOpen && (
        <Sheet open={mobileMenuOpen} onOpenChange={setMobileMenuOpen}>
          <SheetContent>메뉴 항목들</SheetContent>
        </Sheet>
      )}
    </header>
  );
}
```

### 2. AdminLayout 타입 구조
```tsx
// app/admin/tournaments/[id]/layout.tsx (NEW)

const ADMIN_TOURNAMENT_TABS = [
  { id: 'dashboard', label: '현황', icon: '📊' },
  { id: 'draw', label: '배정', icon: '🎯' },
  { id: 'edit', label: '수정', icon: '✏️' },
  // ... 등등
];

export default function AdminTournamentLayout({ children, params }) {
  const pathname = usePathname();
  
  return (
    <div>
      {/* 탭 네비게이션 */}
      <Tabs value={getCurrentTab(pathname)}>
        {ADMIN_TOURNAMENT_TABS.map(tab => (
          <TabsTrigger key={tab.id} value={tab.id}>
            <Link href={`/admin/tournaments/${params.id}/${tab.id}`}>
              {tab.icon} {tab.label}
            </Link>
          </TabsTrigger>
        ))}
      </Tabs>

      {children}
    </div>
  );
}
```

### 3. 앵커 메뉴 기본 구조
```tsx
// components/TableOfContents.tsx (NEW)

interface TOCItem {
  id: string;
  label: string;
  icon?: string;
}

export default function TableOfContents({ items, activeSection }: Props) {
  return (
    <div className="
      hidden lg:block 
      fixed right-6 top-20 
      w-64 
      border rounded-lg p-4
      max-h-[calc(100vh-100px)]
      overflow-y-auto
    ">
      <h3 className="font-bold mb-3">📑 목차</h3>
      <nav className="space-y-2">
        {items.map(item => (
          <a
            key={item.id}
            href={`#${item.id}`}
            className={`
              block py-1 px-2 rounded text-sm
              ${activeSection === item.id 
                ? 'bg-blue-100 font-bold' 
                : 'hover:bg-gray-100'
              }
            `}
          >
            {item.icon} {item.label}
          </a>
        ))}
      </nav>
    </div>
  );
}
```

---

## 마이그레이션 체크리스트

### Phase 1 체크리스트
- [ ] Header 컴포넌트에 Sheet 또는 Drawer 추가
- [ ] 모바일 햄버거 메뉴 구현
- [ ] 반응형 테스트 (모바일 뷰포트)
- [ ] AdminLayout 햄버거 추가

### Phase 2 체크리스트
- [ ] `app/admin/tournaments/[id]/layout.tsx` 생성
- [ ] 탭 네비게이션 구현
- [ ] 10개 서브페이지와 동기화
- [ ] 활성 탭 하이라이트

### Phase 3 체크리스트
- [ ] 대회 상세 페이지 섹션 ID 추가
- [ ] TableOfContents 컴포넌트 구현
- [ ] 모바일/PC 다른 표현 방식 구현
- [ ] 각 관리자 페이지별 추가 개선

---

## 결론 및 기대효과

### 개선 예상 지표
- **모바일 사용성**: 40% 향상 (네비게이션 명확화)
- **관리자 효율성**: 30% 증가 (통합 네비게이션)
- **사용자 만족도**: 스크롤 감소로 UX 개선
- **접근성**: 키보드 네비게이션, 스크린리더 지원 추가

### 추진 기간
- 총 예상 기간: 3.5주
- 단계별 배포 가능 (각 Phase마다 독립적)

### 유지보수 고려사항
- 신규 네비게이션 항목 추가 시 설정 파일 수정
- 레이아웃 변경은 중앙화된 컴포넌트에서 관리
- 미디어쿼리는 Tailwind 벤치마크 유지

---

**작성일:** 2026-02-16  
**담당자:** AI Assistant  
**상태:** 검토 대기
