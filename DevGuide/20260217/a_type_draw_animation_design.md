# A형(방송 그래픽) 라이브 조추첨 연출 설계서
> 목표: “결과 공개”가 아니라 **후보 전체가 항상 보이는 상태에서**  
> 하이라이트/가속·감속/근접(될 뻔) 구간으로 **기대 심리**를 만들며,  
> 진행자(관리자)가 **스텝별 확정/변경**까지 할 수 있는 라이브 조편성 연출.

본 문서는 두 가지 연출을 **독립 모듈(Animator 플러그인)**로 설계한다.

1) **전광판 하이라이트(그리드/리스트 스캔)**
2) **캐러셀/원통(2.5D) 회전 + 피킹 포인트**

둘 다 공통으로:
- 후보가 “처음부터 끝까지” 화면에 공개되어 존재한다(완전 블라인드 추첨 X)
- 최종 확정 전에는 “결과를 숨기되” 과정은 납득 가능하게 연출한다
- Supabase Realtime 이벤트로 **모든 시청자 화면 동기화**
- Next.js + Supabase + Vercel 기반 유지

---

## 0. 추천 기술 스택(깔끔/실무형)

### 공통(필수)
- **Next.js (App Router)**: UI/페이지/권한/라우팅
- **Supabase**: Auth + Postgres + Realtime(Broadcast)
- **Vercel**: 배포

### 연출/모션(권장: “A형 방송 그래픽”용)
- **Rive**: 배경/프레임/전환/글로우/방송 그래픽 모션(툴 기반으로 고퀄 확보)
- **Framer Motion**: React UI 요소(카드/하이라이트/줌/슬로우다운) 트윈
- **CSS 2.5D(Transforms)**: 캐러셀 원통(3D 엔진 없이 고급스러운 원근 연출)

### 텍스트/가독성(권장)
- 후보 카드에는 **번호 + 이름(짧게) + 부가정보(핸디/성별 등)**  
- 긴 이름/정보는 “확정 순간”에만 하단 타이틀바(방송 자막)로 크게 노출

> 핵심: “렌더러를 바꾸는 것”보다 **모션 제작 툴(Rive) + UI 트윈(Framer Motion)** 조합이  
> 수정→수정 반복 없이 ‘한 방’으로 방송급 룩을 만들기 훨씬 쉽다.

---

## 1. 공통 시스템 설계(두 연출 공용)

### 1.1 역할
- **진행자(관리자)**: 세션 시작/스텝 진행/타겟 조 지정/확정/변경/되돌리기(옵션)
- **시청자(로그인)**: 라이브 구독 + 동일 연출 시청(읽기 전용)

### 1.2 조편성 규칙(예)
- 40명, 10개조, 조당 4명
- 스텝은 총 40회(1명씩 뽑아 조에 배정)

### 1.3 이벤트 스트리밍(영상 X)
동영상을 보내는 게 아니라, “무슨 일이 일어났는지” 이벤트만 실시간으로 보낸다.  
클라이언트는 이벤트를 받아 동일한 애니메이션을 재생한다.

#### 이벤트 타입(권장)
- `SESSION_STARTED`
- `STEP_CONFIGURED`  (이번 스텝 모드/타겟 조/연출 파라미터)
- `SCAN_TICK`        (선택: 하이라이트 경로를 완전 동일하게 만들고 싶을 때)
- `PICK_RESULT`      (당첨자 결정)
- `ASSIGN_UPDATED`   (확정 전 조 변경)
- `ASSIGN_CONFIRMED` (확정)
- `SESSION_FINISHED` (완료)

> **A형 연출**은 “과정 투명성”이 중요하므로  
> 하이라이트 경로가 모든 클라이언트에서 동일해야 한다.  
> 이를 위해 `SCAN_TICK`을 쓰거나(완전 동기), 또는 “seed + 타임라인”으로 동일 재생(가벼움)한다.

### 1.4 동기화 전략(권장: seed + 타임라인)
- `STEP_CONFIGURED`에 `seed`, `startedAt`, `durationMs`를 포함
- 각 클라이언트는 **동일 seed**로 “하이라이트 경로/가속·감속 곡선”을 재현
- `PICK_RESULT` 도착 전까지는 확정자 노출 금지  
- `PICK_RESULT`가 오면, 현재 커서가 “당첨자 근처에서 멈추도록” 마지막 1~2초 구간을 자연스럽게 수렴

> 이 구조면 서버가 결과를 미리 정해도(또는 스텝 직전에 정해도)  
> 시청자는 **연출 끝날 때까지 결과를 모른다** + 화면은 완전 동일하다.

### 1.5 DB 모델(요약)
- `draw_sessions`
  - `id, tournament_id, status, group_count, group_size, created_by, started_at`
- `draw_events`
  - `id, session_id, seq, type, payload(jsonb), created_at`
- `draw_assignments`(선택: 조회 최적화)
  - `session_id, player_id, group_no, step`

> 초기에는 `draw_events` 리플레이로 상태 복원하는 방식이 단순하고 확장성 좋음.

### 1.6 늦게 들어온 시청자 처리
- 페이지 진입 시:
  1) 세션/이벤트 목록을 가져와 reducer로 상태 재구성
  2) 현재 진행 중인 스텝이 있으면 `startedAt` 기준으로 애니메이션 “중간 프레임”에서 합류
- UI 옵션:
  - “LIVE로 바로 점프” / “빠른 리플레이 후 LIVE 합류”

---

## 2. 공통 UI 구성(A형 방송 그래픽)

### 2.1 레이아웃(PC)
- 상단: 타이틀/현재 스텝/타겟 조(“이번은 7조 자리”) + LIVE 표시
- 중앙: **연출 영역(Animator Canvas/DOM)**  
- 우측(또는 하단): 1~10조 박스(누적 결과)
- 하단: “방송 자막 바” (이번 당첨자/다음 진행 안내)

### 2.2 모바일 레이아웃
- 중앙 연출 영역 크게(16:9 or 4:3)
- 조 박스는 2열 그리드(스크롤)
- 하단 자막 바 유지(가독성)

### 2.3 진행자 패널(관리자만)
- 모드 선택: `ROUND_ROBIN` / `TARGET_GROUP`
- 타겟 조 드롭다운(타겟 모드 시)
- “스텝 시작” 버튼
- “확정” 버튼
- (옵션) “조 변경(드롭다운/드래그)” / “되돌리기”

---

## 3. 공통 비즈니스 로직(조 배정)

### 3.1 모드
- `ROUND_ROBIN`: `targetGroupNo = (step % groupCount) + 1`
- `TARGET_GROUP`: 진행자가 이번 스텝 대상 조를 미리 선택

### 3.2 스텝 진행 규칙
- `STEP_CONFIGURED` 발행 후 애니메이션 시작
- `PICK_RESULT`는 서버(또는 진행자 액션)에서 남은 후보 중 1명 선택
- 확정 전 변경:
  - `ASSIGN_UPDATED`: `playerId`를 다른 `groupNo`로 이동 가능
- 확정:
  - `ASSIGN_CONFIRMED` → remaining pool에서 제거, groups에 추가

---

# 4. 연출 1) 전광판 하이라이트(그리드/리스트 스캔)

## 4.1 목표 UX(“나인가?” 기대감)
- 후보 전체 카드가 그리드로 **항상 노출**
- 하이라이트 커서가 빠르게 이동하며 여러 후보를 “스캔”
- 감속하면서 특정 구간 주변을 맴돌며 “될 뻔”을 반복
- 최종 1명에서 멈추며 확정(자막 바에 크게 노출)

## 4.2 화면 구성
- 중앙: 후보 그리드(예: 8×5 = 40명)
- 하이라이트:
  - 현재 후보: 강한 글로우 + 살짝 확대
  - 직전/다음 후보: 약한 하이라이트(잔상)
- 하단 자막: `현재 후보`, `남은 후보 수`, `이번은 X조 자리`

## 4.3 동기화 방식(강추)
### 옵션 A(가벼움): seed 기반 경로 생성
`STEP_CONFIGURED.payload` 예:
```json
{
  "step": 17,
  "mode": "TARGET_GROUP",
  "targetGroupNo": 7,
  "startedAt": 1730000000000,
  "durationMs": 9000,
  "seed": 8237461,
  "pattern": "grid-scan-v2",
  "tempo": { "baseHz": 18, "slowdownMs": 2500, "nearMiss": 3 }
}
```

- 클라이언트는 `seed`로 “하이라이트 이동 순서(인덱스)”를 생성
- `slowdownMs` 구간에서 가속→감속 곡선 적용
- `nearMiss` 횟수만큼 당첨자 주변을 왕복(될 뻔 연출)
- `PICK_RESULT`가 오면 마지막 구간이 당첨자 인덱스로 수렴

### 옵션 B(완전 동기): tick 이벤트 스트리밍
- 진행자가 `SCAN_TICK`을 10~20Hz로 발행
- 모든 클라이언트가 동일 tick을 받아 동일 후보를 하이라이트
- 단점: 트래픽 증가(그래도 충분히 감당 가능)

> 추천: **A(Seed)** 가 유지보수/트래픽/지연 내성이 좋다.

## 4.4 하이라이트 경로 알고리즘(실제 구현 수준)
- 후보 N명을 0..N-1로 인덱싱(그리드 포지션 매핑)
- `seed`로 PRNG 생성(예: mulberry32)
- 초기 60% 구간: 빠른 랜덤 이동(“정말 랜덤” 느낌)
- 60~85% 구간: 후보 주변 “군집 이동”(기대감 상승)
- 마지막 15% 구간: 당첨자 주변 near-miss 왕복 후 최종 멈춤

Pseudo:
- `path[]` 길이는 `durationMs * baseHz`
- `path[t] = nextIndex(seed, t)`
- 마지막 구간:
  - `path[t] = mix(path[t], winnerIndex, easeOutCubic(progress))`
  - near-miss: `winnerIndex ± 1..3`을 번갈아 찍다 최종 winner

## 4.5 구현 기술(추천)
- 후보 카드 렌더: React(가독성/반응형 용이)
- 하이라이트/확대/글로우: **Framer Motion + CSS box-shadow**
- 배경/프레임/전환(방송 그래픽): **Rive** (선택이지만 “A형”에 강추)

### 컴포넌트 구조
- `ScoreboardAnimator.tsx` (연출 본체)
- `CandidateGrid.tsx` (그리드)
- `CandidateCard.tsx` (카드)
- `LowerThird.tsx` (하단 자막 바)
- `useDrawSync.ts` (Supabase 이벤트 구독 + reducer)

## 4.6 단계별 트리거
- `STEP_CONFIGURED` 수신:
  - Rive: `start_step` 트리거
  - Grid: path 생성 후 하이라이트 시작
- `PICK_RESULT` 수신:
  - 마지막 구간에서 winner로 수렴
- `ASSIGN_CONFIRMED` 수신:
  - winner 카드가 해당 조 박스로 “슬라이드 이동”(Framer Motion layout)

---

# 5. 연출 2) 캐러셀/원통(2.5D) 회전 + 피킹 포인트

## 5.1 목표 UX
- 후보 카드들이 “원통 트랙”을 돌며 **다 보이거나(또는 대부분 보이도록)** 유지
- 화면 중앙의 “피킹 포인트(선택 슬롯)”에 가까워질 때마다 심장이 쫄깃
- 감속하며 “거의 당첨” 후보들이 몇 번 스쳐 지나가고 최종 멈춤
- 당첨 후보는 전면으로 pop → 하단 자막 바에 크게 표시 → 조에 배정

## 5.2 렌더링(3D 엔진 없이 구현)
- CSS 3D Transform으로 원통 효과:
  - 각 카드에 `rotateY(theta) translateZ(radius)`
  - 전체 원통 컨테이너에 `rotateY(globalRotation)`
- 원근감:
  - `perspective` + 전면 카드만 크게/선명, 뒤로 갈수록 작게/흐리게(blur는 최소)
- 애니메이션:
  - Framer Motion으로 `globalRotation` 트윈(가속/감속)

> 장점: Pixi/Three 없이도 “2.5D 방송 그래픽”이 깔끔하게 가능.

## 5.3 데이터 표시 전략(중요)
- 후보가 40명이면 원통에 40장을 전부 달면 복잡/가독성↓
- 권장:
  - 원통에는 “번호 + 이름(짧게)”만
  - 옆/아래 패널에서 전체 후보 리스트(작게) 동시 표시(‘전체 공개’ 조건 충족)
  - 또는 원통에는 40장 모두, 대신 카드 디자인을 아주 단순하게

## 5.4 동기화(Seed 기반 회전 목표)
`STEP_CONFIGURED.payload` 예:
```json
{
  "step": 3,
  "mode": "ROUND_ROBIN",
  "targetGroupNo": 4,
  "startedAt": 1730000000000,
  "durationMs": 8500,
  "seed": 991231,
  "pattern": "carousel-v1",
  "tempo": { "spinTurns": 6, "slowdownMs": 2600, "nearMiss": 2 }
}
```

- `PICK_RESULT`의 winnerIndex를 알게 되면
  - 최종 회전각 = `currentRotation + 2π*spinTurns + angleToWinnerSlot`
  - near-miss 연출: winner 앞뒤 카드 슬롯을 몇 번 지나치게 만든 뒤 최종 멈춤

## 5.5 캐러셀 각도 계산(구현 수준)
- 후보 N명, 각도 간격: `stepAngle = 360 / N`
- 전면(피킹 포인트)을 0도로 정의
- winnerIndex에 해당하는 카드가 전면에 오려면:
  - `targetRotationDeg = -winnerIndex * stepAngle`
- 실제 연출:
  - `finalRotationDeg = currentDeg + 360*spinTurns + targetRotationDeg + jitter`
  - `jitter`는 마지막에 0으로 수렴(“흔들리다 멈춤”)

## 5.6 구현 기술(추천)
- 캐러셀: React + CSS 3D + Framer Motion
- 배경 프레임/전환: Rive(강추)
- 당첨 pop/글로우: Framer Motion + CSS

### 컴포넌트 구조
- `CarouselAnimator.tsx`
- `CarouselRing.tsx` (원통)
- `CarouselCard.tsx`
- `CandidateListPanel.tsx` (전체 후보 공개 패널)
- `LowerThird.tsx`

---

## 6. 공통: “A형 방송 그래픽” 룩을 만드는 체크리스트(한 방 퀄리티 업)
- [ ] 배경에 subtle 그라데이션 + 아주 약한 노이즈(정적 이미지)  
- [ ] 카드/타이틀에 8px~16px 라운드 + 얕은 그림자(과하지 않게)
- [ ] 하이라이트는 “색 + 글로우 + 살짝 확대” 3종 세트
- [ ] 최종 확정 순간:  
  - 화면 살짝 줌(1.00→1.03)  
  - 하단 자막 바 등장(0.25s)  
  - “띵” 사운드(선택)
- [ ] 후보 카드 안에 너무 많은 정보를 넣지 않기(가독성 최우선)

---

## 7. 구현 단계(추천 로드맵)
1) 공통: 세션/이벤트/리플레이(reducer) + Realtime 구독 구축  
2) UI: 조 박스/하단 자막/진행자 패널 완성  
3) 연출 1(전광판): seed 기반 path 생성 + near-miss + winner 수렴  
4) 연출 2(캐러셀): CSS 3D 원통 + 회전/감속 + winner 슬롯 정렬  
5) Rive 프레임/전환 적용(방송 그래픽 완성)  
6) 모바일 최적화(카드 수/블러 최소/low mode 옵션)

---

## 8. “진짜 구현”을 위해 필요한 산출물
- 후보 카드 디자인(피그마든 뭐든)
- Rive 파일(.riv) 1개(공통 프레임 + 상태머신)
  - Inputs: `start_step`, `reveal_pick`, `confirm_assign`, `target_group_no`
- 개발 산출물:
  - `useDrawSync` 훅(Realtime + reducer)
  - `ScoreboardAnimator` + `CarouselAnimator`
  - 관리자 패널(스텝 시작/확정/타겟 조)

---

## 9. 부록: PRNG(Seed) 예시
- mulberry32 / xorshift32 같은 경량 PRNG 사용
- JS에서 seed 고정하면 모든 클라이언트가 동일 경로를 재현 가능

---

# 최종 요약
- 너가 원하는 “과정 공유 + 기대감”은  
  **전광판 스캔**과 **캐러셀 피킹 포인트**가 가장 성공 확률 높고,
- “A형 방송 그래픽” 퀄리티는  
  **Rive(프레임/전환) + Framer Motion(UI 트윈)** 조합이 가장 효율적이다.
