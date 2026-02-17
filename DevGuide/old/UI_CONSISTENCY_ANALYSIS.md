# UI 일관성 분석 보고서
**작성일**: 2026-02-11

---

## 1. 핵심 문제

현재 프로젝트의 UI에서 **사용자 인터렉션이 가능한 요소**와 **읽기 전용 정보**가 **시각적으로 구분되지 않음**.

```
예시 (Header 네비게이션):
┌─────────────────────────────────────────────────┐
│ ⛳ Just Golf  |  비2님  홈  내 프로필  🔘로그아웃  │
└─────────────────────────────────────────────────┘
                   ↓                    ↓
           순수 텍스트처럼 보임      버튼처럼 보임
           (마우스 올려야 인지)     (명확함)
```

---

## 2. 현재 분류 체계

### 2.1 정보(Information) - 읽기만
| 예시 | 파일 | 표현 |
|------|------|------|
| 닉네임 "비2님" | Header.tsx | 순수 텍스트 `<span>` |
| 이메일 "user@example.com" | profile/page.tsx | `<Input disabled>` |
| 대회 제목 "2026 Spring Golf" | t/[id]/page.tsx | 텍스트 |
| 등록자 닉네임 | admin/.../registrations/page.tsx | 테이블 셀 |

### 2.2 상태(Status) - 읽기 전용, 값 표시
| 예시 | 파일 | 현재 표현 | 문제점 |
|------|------|---------|--------|
| "신청됨" | admin/.../registrations | Badge or 텍스트 | **일관성 없음** |
| "확정" | admin/.../registrations | Badge or 텍스트 | 같은 정보인데 표현 다름 |
| "대기중" | admin/.../registrations | Badge or 텍스트 | - |
| "취소됨" | admin/.../registrations | Badge or 텍스트 | - |
| "진행중" (대회) | t/[id]/page.tsx | 텍스트 또는 색상 | - |

### 2.3 액션(Action) - 상호작용 가능 ⚠️ **가장 문제 많음**

#### A. Navigation/Secondary Actions
| UI | 컴포넌트 | Variant | 시각 | 문제 |
|-----|---------|---------|------|------|
| "홈" | Header.tsx | `<Button asChild variant="ghost">` | 텍스트 | ❌ 클릭 가능한지 불명확 |
| "내 프로필" | Header.tsx | `<Button asChild variant="ghost">` | 텍스트 | ❌ 클릭 가능한지 불명확 |
| "관리자" | Header.tsx | `<Button asChild variant="ghost">` | 텍스트 | ❌ 클릭 가능한지 불명확 |
| "로그아웃" | Header.tsx | `<Button variant="outline">` | 명확한 버튼 | ✅ 일관성 있음 |

#### B. Primary Actions
| UI | 컴포넌트 | Variant | 시각 | 문제 |
|-----|---------|---------|------|------|
| "신청하기" | t/[id]/page.tsx | `<Button>` (default) | 파란색 버튼 | ✅ 명확 |
| "추가 참가자" | t/[id]/page.tsx | `<Button>` (default) | 파란색 버튼 | ✅ 명확 |
| "닉네임 변경" | profile/page.tsx | `<Button>` (default) | 파란색 버튼 | ✅ 명확 |
| "선택 확정" | admin/.../registrations | `<Button>` (default) | 파란색 버튼 | ✅ 명확 |

#### C. Destructive/Dangerous Actions
| UI | 컴포넌트 | Variant | 시각 | 문제 |
|-----|---------|---------|------|------|
| "삭제" | t/[id]/page.tsx | `<Button variant="destructive">` | 빨간색 | ✅ 명확 |
| "취소" | t/[id]/page.tsx | `<Button variant="outline">` | 테두리 | ✅ 명확 |

#### D. Navigation Links
| UI | 컴포넌트 | 시각 | 문제 |
|-----|---------|------|------|
| "다시 로그인" | profile/page.tsx | `<Button asChild variant="outline">` | 테두리 | ✅ 명확 |
| "대회 목록" | 여러 곳 | `<Button asChild variant="outline">` | 테두리 | ✅ 명확 |

---

## 3. Button Variants 정의

### button.tsx에서 정의된 6가지 variant:

```tsx
const buttonVariants = cva(..., {
  variants: {
    variant: {
      // 1. 주요 액션 - 파란색 배경 + 흰색 텍스트
      default: "bg-primary text-primary-foreground hover:bg-primary/90",
      
      // 2. 삭제/위험 - 빨간색 배경 + 흰색 텍스트
      destructive: "bg-destructive text-white hover:bg-destructive/90",
      
      // 3. 보조 네비게이션/링크 - 테두리만
      outline: "border bg-background shadow-xs hover:bg-accent",
      
      // 4. 보조 액션 - 회색 배경
      secondary: "bg-secondary text-secondary-foreground hover:bg-secondary/80",
      
      // 5. 텍스트처럼 보이는 버튼 - hover일 때만 배경
      ghost: "hover:bg-accent hover:text-accent-foreground",
      
      // 6. 링크 스타일 - 언더라인
      link: "text-primary underline-offset-4 hover:underline",
    },
  }
})
```

---

## 4. 현재 패턴 분석

### 원인 1: Ghost Variant 오남용
```tsx
// Header.tsx - 문제 케이스
<Button asChild size="sm" variant="ghost">
  <Link href="/start">홈</Link>
</Button>

// vs 명확한 경우
<Button onClick={handleLogout} size="sm" variant="outline">
  로그아웃
</Button>
```

- **`ghost`**: 기본 상태에서 배경 없음 → hover해야만 인지 가능
- **`outline`**: 기본 상태에서 테두리 있음 → 즉각 인지 가능

### 원인 2: Status 표시 일관성 부족
```tsx
// 방법 1: Badge 사용 (색상)
<Badge variant="outline" className="bg-blue-50 text-blue-800">신청됨</Badge>

// 방법 2: 순수 텍스트
<td className="text-slate-700">신청됨</td>

// 방법 3: 색상 칠하기 (단색)
<div className="p-3 bg-blue-50 rounded-md border border-blue-200">
  <p className="text-xs text-blue-700 font-medium">신청</p>
  <p className="text-2xl font-bold text-blue-900">42</p>
</div>

// 방법 4: 상태별 스타일로 표시
{statusLabels[status]}  // 객체에서 가져옴
```

→ **같은 정보인데 파일마다 다르게 표현**

---

## 5. 구체적 문제 사례

### 5.1 Header 네비게이션
**현재 코드** (`components/Header.tsx` L90-107):
```tsx
<nav className="flex items-center gap-2">
  {user && (
    <>
      <span className="text-sm font-medium text-slate-700">
        {profileNickname ? `${profileNickname}님` : "닉네임 없음"}
      </span>
      
      {/* ❌ 문제: ghost variant로 텍스트처럼 보임 */}
      <Button asChild size="sm" variant="ghost">
        <Link href="/start">홈</Link>
      </Button>
      
      {/* ❌ 문제: ghost variant로 텍스트처럼 보임 */}
      <Button asChild size="sm" variant="ghost">
        <Link href="/profile">내 프로필</Link>
      </Button>
      
      {/* ✅ 좋음: outline으로 명확한 버튼 */}
      <Button onClick={handleLogout} size="sm" variant="outline">
        로그아웃
      </Button>
    </>
  )}
</nav>
```

**사용자 입장**:
- "홈" 텍스트 → 클릭 가능? (마우스 올려봐야 알 수 있음)
- "내 프로필" 텍스트 → 클릭 가능? (마우스 올려봐야 알 수 있음)
- "로그아웃" 버튼 → 명확하게 클릭 가능

### 5.2 관리자 신청자 관리 페이지
**현재 코드** (`app/admin/tournaments/[id]/registrations/page.tsx` L185-260):

상태 표시가 섞여 있음:
```tsx
{/* 통계 카드 - 매우 명확한 상태 표시 */}
<div className="p-3 bg-blue-50 rounded-md border border-blue-200">
  <p className="text-xs text-blue-700 font-medium">신청</p>
  <p className="text-2xl font-bold text-blue-900">{stats.statusCount.applied}</p>
</div>

{/* vs 테이블 셀 - 색상 없이 텍스트만 */}
<TableCell>
  {row.status}  {/* "applied", "approved" 등 */}
</TableCell>

{/* vs 상태 선택 드롭다운 */}
<Select onValueChange={(val) => updateStatus(row.id, val as Registration["status"])}>
  <SelectTrigger>
    <SelectValue placeholder="상태 선택" />
  </SelectTrigger>
  <SelectContent>
    {statuses.map((status) => (
      <SelectItem key={status} value={status}>
        {formatRegistrationStatus(status)}
      </SelectItem>
    ))}
  </SelectContent>
</Select>
```

→ 같은 "신청" 상태를 3가지 방식으로 표현

### 5.3 신청 페이지 액션 버튼들
**현재 코드** (`app/t/[id]/page.tsx` 여러 곳):

```tsx
{/* Primary action - default variant */}
<Button onClick={applyMine}>신청하기</Button>

{/* Secondary action - outline variant */}
<Button onClick={cancelMine} variant="outline">신청 취소</Button>

{/* Destructive action - 문제: outline variant 사용 */}
<Button 
  onClick={() => deleteParticipant(r.id)}
  variant="outline"  {/* ❌ destructive가 아님 */}
>
  삭제
</Button>

{/* vs 정확한 destructive variant */}
<Button variant="destructive">삭제</Button>
```

→ 삭제는 위험 작업인데 outline으로 표현되어 일관성 없음

---

## 6. 현재 사용 통계

### Button Variant 사용 빈도 (50개 샘플 검색)
```
outline:  36건 (72%) ← 가장 많음
default:   8건 (16%)
ghost:     4건 (8%)  ← ghost가 Navigation에만 사용
destructive: 2건 (4%)
```

**분석**:
- `outline`이 과도하게 많음 (링크, 보조 액션, 주의 액션 등 섞여 있음)
- `ghost`는 아주 적게만 사용됨 (Header에만 집중)
- `default`는 primary action에만 사용됨 (일관성 있음)
- `destructive`는 너무 적게 사용됨 (삭제 작업이 있는데 outline으로 대체)

---

## 7. UI 계층 정리

### UI 3-계층 분류 모델

```
┌─────────────────────────────────────────────┐
│  1️⃣ INFORMATION (정보)                      │
│     읽기만 가능, 상호작용 불가              │
├─────────────────────────────────────────────┤
│  예: "비2님", "user@example.com"            │
│  표현: <span>, <td>, 색상 없음              │
└─────────────────────────────────────────────┘

┌─────────────────────────────────────────────┐
│  2️⃣ STATUS (상태)                           │
│     읽기 전용, 상태/값 표시                │
├─────────────────────────────────────────────┤
│  예: "신청됨", "확정", "대기중"             │
│  표현: Badge, 색상 배경, 텍스트             │
│  ⚠️ 현재: 일관성 부족                        │
└─────────────────────────────────────────────┘

┌─────────────────────────────────────────────┐
│  3️⃣ INTERACTION (상호작용)                  │
│     클릭/입력/선택 가능 → 명확해야 함       │
├─────────────────────────────────────────────┤
│  A. Primary Action                          │
│     예: "신청하기", "저장", "확정"          │
│     색상: 파란색 (주목성 높음)              │
│     Variant: default                        │
├─────────────────────────────────────────────┤
│  B. Secondary/Navigation Action             │
│     예: "뒤로 가기", "목록보기", "내 프로필"│
│     색상: 테두리/회색 (주목성 낮음)         │
│     Variant: outline, ghost                 │
│     ⚠️ 현재: ghost가 명확하지 않음         │
├─────────────────────────────────────────────┤
│  C. Destructive Action                      │
│     예: "삭제", "취소"                      │
│     색상: 빨간색 (경고)                     │
│     Variant: destructive                    │
│     ⚠️ 현재: 소수만 사용, outline으로 대체 │
└─────────────────────────────────────────────┘
```

---

## 8. 권장 개선 방안

### 8.1 Button Variant 사용 규칙

| 요소 | Variant | 용시 | 명확성 |
|------|---------|------|--------|
| **Primary Action** | `default` | "신청하기", "저장", "추가" → 파란색 | ✅ 매우 높음 |
| **Secondary Action** | `outline` | "뒤로", "목록보기", "링크 이동" → 테두리 | ✅ 높음 |
| **Tertiary/Subtle** | `secondary` | 선택적 액션 → 회색 배경 | ✅ 중간 |
| **Destructive** | `destructive` | "삭제", "취소", "거부" → 빨간색 | ✅ 매우 높음 |
| ~~**Ghost**~~ | ~~`ghost`~~ | ~~텍스트 링크처럼 보임~~ | ❌ 불명확 |
| **Link** | `link` | 인라인 링크 (문장 내) → 언더라인 | ✅ 높음 |

### 8.2 Status 표시 통일안

**원칙**: 같은 정보는 같은 방식으로 표현

**방안 1: Badge 컴포넌트 사용 (추천)**
```tsx
// 모든 상태 표시는 Badge 사용
<Badge className="bg-blue-50 text-blue-800">신청됨</Badge>
<Badge className="bg-green-50 text-green-800">확정</Badge>
<Badge className="bg-yellow-50 text-yellow-800">대기중</Badge>
<Badge className="bg-slate-50 text-slate-800">취소됨</Badge>
```

**방안 2: 상태 레이블 helper 함수 (추가)**
```tsx
// lib/statusLabels.ts에 추가
export function StatusBadge({ status }: { status: string }) {
  const colorMap = {
    applied: "bg-blue-50 text-blue-800",
    approved: "bg-green-50 text-green-800",
    waitlisted: "bg-yellow-50 text-yellow-800",
    canceled: "bg-slate-50 text-slate-800",
  };
  
  return (
    <Badge className={colorMap[status] ?? ""}>
      {formatRegistrationStatus(status)}
    </Badge>
  );
}
```

---

## 9. 검토 Checklist

### 현재 상태
- ❌ Header 네비게이션 (ghost → outline/secondary로 변경 필요)
- ❌ Status 표시 일관성 (Badge 통일 필요)
- ✅ Primary action (default variant 사용 일관적)
- ❌ Destructive action (outline → destructive로 변경 필요)
- ❌ Navigation link 구분 (outline vs ghost 혼용)

### 우선순위
1. 🔴 **High**: Header 네비게이션 (`ghost` → `outline`)
2. 🔴 **High**: Destructive 버튼 (`outline` → `destructive`)
3. 🟡 **Medium**: Status 표시 통일 (Badge)
4. 🟡 **Medium**: 문서화 (가이드라인 작성)

---

## 10. 추가 고려사항

### 10.1 모바일 환경
- Header의 네비게이션이 모바일에서 메뉴로 변환되는지 확인 필요
- Ghost variant는 터치 환경에서 더욱 구분이 어려움

### 10.2 다크모드
- 현재 `dark:` Tailwind prefix가 있음
- 색상 변경 시 다크모드 테스트 필수

### 10.3 접근성
- `aria-* 속성 검토 필요
- 색상만으로 상태 구분하면 안 됨 (이제 좀 개선됨)

---

## 참고

**관련 파일**:
- `components/ui/button.tsx`: Button 정의
- `components/Header.tsx`: Navigation 사용 예시
- `lib/statusLabels.ts`: 상태 표시 함수
- `app/t/[id]/page.tsx`: 신청 페이지
- `app/admin/tournaments/[id]/registrations/page.tsx`: 관리자 페이지

**외부 참조**:
- shadcn/ui Button docs: https://ui.shadcn.com/docs/components/button
- Material Design 버튼: https://m3.material.io/components/buttons
