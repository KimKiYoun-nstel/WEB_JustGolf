# 모바일 채팅 참가자 리스트 구현 옵션

**작성일**: 2026-03-07  
**상태**: 설계 보류  
**목적**: PC 채팅창 사이드바와 동등한 모바일 UX 제공

---

## 배경

- **PC 구현**: 192px 우측 사이드바에 참가자 목록 고정 표시
- **모바일 제약**: 화면 폭이 좁아 사이드바 불가능
- **요구사항**: 메시지 보기를 방해하지 않으면서 참가자 확인 가능

---

## 옵션 1: Bottom Sheet (추천) ⭐

### 설계
```tsx
// app/t/[id]/draw/page.tsx (모바일 Sheet 내부)
const [showParticipants, setShowParticipants] = useState(false);
const [participants, setParticipants] = useState<string[]>([]);

// 헤더 (채팅 상태 옆)
<Button 
  variant="outline" 
  size="sm" 
  className="h-8"
  onClick={() => setShowParticipants(true)}
>
  참가자 {participants.length}명
</Button>

// Nested Sheet
<Sheet open={showParticipants} onOpenChange={setShowParticipants}>
  <SheetContent side="bottom" className="h-[60vh]">
    <SheetHeader>
      <SheetTitle>참가자 목록 ({participants.length}명)</SheetTitle>
    </SheetHeader>
    <div className="flex-1 overflow-y-auto py-4">
      <ul className="space-y-2">
        {participants.map((nick, idx) => (
          <li key={idx} className="flex items-center gap-2 px-4 py-2">
            <span className="h-2 w-2 rounded-full bg-emerald-500" />
            <span>{nick}</span>
          </li>
        ))}
      </ul>
    </div>
  </SheetContent>
</Sheet>
```

### 장점
- 자연스러운 모바일 UX (하단 스와이프로 닫기)
- 메시지 영역을 전혀 가리지 않음
- 채팅 자체가 Sheet이므로 동일한 상호작용 패턴 유지
- shadcn Sheet는 nested 구조 지원함

### 단점
- Sheet 안에 또 Sheet (nested) - 구조가 다소 복잡
- z-index 관리 필요 (Sheet 기본값: 50, nested는 더 높게)

### 구현 포인트
- `participants` 상태는 메시지 로드/Realtime 구독 시 `Array.from(new Set(messages.map(m => m.nickname)))` 로 추출
- 헤더 버튼은 `variant="outline" size="sm" h-8`로 상태 Badge와 통일
- Sheet는 `side="bottom"` + `h-[60vh]`로 스크롤 가능하게

---

## 옵션 2: Collapsible 인라인

### 설계
```tsx
<div className="border-b bg-white">
  <button 
    onClick={() => setParticipantsExpanded(!participantsExpanded)}
    className="flex w-full items-center justify-between px-4 py-2 text-sm hover:bg-slate-50"
  >
    <span className="font-medium">참가자 {participants.length}명</span>
    <ChevronDown 
      className={cn(
        "h-4 w-4 transition-transform",
        participantsExpanded && "rotate-180"
      )} 
    />
  </button>
  
  {participantsExpanded && (
    <ul className="max-h-32 overflow-y-auto border-t bg-slate-50 px-4 py-2">
      {participants.map((nick, idx) => (
        <li key={idx} className="flex items-center gap-2 py-1 text-sm">
          <span className="h-1.5 w-1.5 rounded-full bg-emerald-500" />
          {nick}
        </li>
      ))}
    </ul>
  )}
</div>
```

### 장점
- 구조 단순 (nested Sheet 없음)
- 즉각적인 펼치기/접기 (모달 오픈 없음)
- 코드량 적음

### 단점
- 펼쳤을 때 메시지 영역 높이가 줄어듦 (max-h 제한 필요)
- 참가자 많으면 목록이 잘림
- "항상 접혀있음" 기본값이면 발견성 낮을 수 있음

### 구현 포인트
- 헤더와 메시지 목록 사이에 Collapsible 섹션 삽입
- `max-h-32` (128px) 정도로 제한해 메시지 영역 침범 최소화
- `animate-accordion-down/up` 적용하면 부드러운 애니메이션 가능

---

## 옵션 3: 플로팅 버튼 + 전체화면 모달

### 설계
```tsx
// 우하단 플로팅 버튼
<button 
  onClick={() => setShowParticipants(true)}
  className="fixed bottom-20 right-4 z-50 flex h-12 w-12 items-center justify-center rounded-full bg-emerald-500 shadow-xl hover:bg-emerald-600"
>
  <Users className="h-5 w-5 text-white" />
  <span className="absolute -right-1 -top-1 flex h-5 min-w-5 items-center justify-center rounded-full bg-red-500 px-1 text-[10px] font-bold text-white">
    {participants.length}
  </span>
</button>

// Dialog 모달
<Dialog open={showParticipants} onOpenChange={setShowParticipants}>
  <DialogContent className="h-[80vh] max-w-md">
    <DialogHeader>
      <DialogTitle>참가자 목록 ({participants.length}명)</DialogTitle>
    </DialogHeader>
    <div className="flex-1 overflow-y-auto">
      {/* 참가자 목록 */}
    </div>
  </DialogContent>
</Dialog>
```

### 장점
- 메시지/입력 UI를 전혀 방해하지 않음
- 배지로 참가자 수 표시하면 실시간 변화 확인 가능
- 전체화면 모달이므로 많은 참가자도 쾌적하게 표시

### 단점
- 플로팅 버튼이 메시지 하단/입력창을 가릴 수 있음
- "숨겨진 기능" 느낌 (헤더에 없으면 발견성 떨어짐)
- UI 요소 추가로 복잡도 증가

### 구현 포인트
- `bottom-20`으로 입력창 위에 배치 (입력창 높이 고려)
- 배지에 참가자 수 표시 (`absolute -right-1 -top-1`)
- Dialog는 `max-w-md` + `h-[80vh]`로 적절한 크기 유지

---

## 권장 사항

### 우선순위 1: **옵션 1 (Bottom Sheet)**
- 모바일 채팅 자체가 Sheet이므로 **일관된 상호작용 패턴**
- 메시지 보기 방해 없음 (가장 큰 UX 목표 달성)
- shadcn Sheet는 nested 안정성 보장

### 고려사항
- 참가자 10명 이하: 옵션 2 (Collapsible)도 충분
- 참가자 수가 계속 변동: 옵션 3 (플로팅 배지)가 실시간성 강조에 유리
- Sheet 성능 이슈 발생 시: 옵션 2로 폴백

---

## 구현 파일
- **타겟**: `app/t/[id]/draw/page.tsx` (시청자 페이지)
- **위치**: 모바일 Sheet 컴포넌트 내부 (`{isCompactLayout && chatOpen && ...}`)
- **참가자 추출**: Realtime 구독 시 `messages.map(m => m.nickname)` → Set 중복 제거
- **상태 관리**: `const [participants, setParticipants] = useState<string[]>([]);`

---

## 참고
- PC 참가자 사이드바 구현: `app/t/[id]/draw/chat/page.tsx` (lines 100-150)
- 모바일 Sheet 구조: `app/t/[id]/draw/page.tsx` (lines 780-900)
- shadcn Sheet 문서: https://ui.shadcn.com/docs/components/sheet
