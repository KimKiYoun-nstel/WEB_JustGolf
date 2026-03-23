# JustGolf 라이브 조추첨 3D 업그레이드 상세 설계

## 1. 문서 목적

이 문서는 `WEB_JustGolf` 레포의 라이브 조추첨 기능에 3D 연출 레이어를 실제로 통합하기 위한 상세 설계 문서다.

이 문서는 다음 수준까지 다룬다.

- 파일 단위 추가/수정 설계
- 컴포넌트 책임 분리
- 상태 흐름
- phase별 동작 규칙
- viewer / admin 연결 방식
- 성능 분기
- 구현 순서
- 테스트 포인트

즉, 이 문서는 바로 개발을 시작할 수 있는 기준 문서다.

---

## 2. 구현 목표

최종 목표는 기존 추첨 시스템의 결과 결정 로직은 유지한 채,
`DrawAnimator`에 새로운 구현체 `stage3d`를 추가하는 것이다.

적용 범위:

- viewer draw 화면
- admin draw 화면
- 공통 draw animation layer
- lowSpecMode 연동

비적용 범위:

- draw DB schema 대규모 변경
- reducer 전체 재작성
- 실시간 subscription 체계 변경
- pick/assign action semantics 변경

---

## 3. 설치 및 패키지 전략

## 3.1 필수 패키지
권장 설치 패키지:

```bash
npm install three @react-three/fiber @react-three/drei framer-motion
```

선택 패키지:

```bash
npm install @react-three/postprocessing
npm install @rive-app/react-canvas
```

## 3.2 패키지 적용 원칙
- 3D 렌더링은 client-only로 동작
- SSR로 렌더링하지 않음
- admin/viewer 페이지에서 dynamic import로 불러옴
- postprocessing은 초기에 필수 아님
- Rive는 브랜딩 모션 필요 시 도입

---

## 4. 파일 구조 제안

```text
components/
  draw/
    DrawAnimator.tsx                 # 기존 수정
    types.ts                         # 기존 수정
    stage3d/
      Stage3DAnimator.tsx            # 신규
      StageScene.tsx                 # 신규
      StageCanvas.tsx                # 신규
      CameraRig.tsx                  # 신규
      StageLighting.tsx              # 신규
      CandidateRing.tsx              # 신규
      CandidateCard3D.tsx            # 신규
      CandidateToken3D.tsx           # 선택 신규
      WinnerFocus.tsx                # 신규
      GroupPodiums.tsx               # 신규
      AssignmentArc.tsx              # 신규
      EnvironmentFloor.tsx           # 신규
      ParticleBursts.tsx             # 신규
      HudOverlay.tsx                 # 신규
      LowerThird.tsx                 # 신규
      StatusBadgeBar.tsx             # 신규
      hooks/
        useStageTimeline.ts          # 신규
        useStageSceneState.ts        # 신규
        usePerformanceTier.ts        # 신규
        usePhaseTransition.ts        # 신규
      lib/
        mapAnimatorPropsToStageState.ts   # 신규
        computeTimelineProgress.ts        # 신규
        computeActiveCandidates.ts        # 신규
        buildRingLayout.ts                # 신규
        buildGroupLayout.ts               # 신규
        computeCameraShot.ts              # 신규
        computeLightingState.ts           # 신규
        easing.ts                         # 신규
      types.ts                       # 신규
```

---

## 5. 기존 파일 수정 상세

## 5.1 `components/draw/types.ts`
### 해야 할 일
`AnimatorKind`에 `"stage3d"`를 추가한다.

### 변경 예시
```ts
export type AnimatorKind = "lotto" | "scoreboard" | "stage3d";
```

### 추가 검토
가능하다면 `AnimatorProps`는 그대로 유지한다.
불가피한 경우에만 optional 필드를 추가한다.

추가해도 되는 optional 필드 예시:
```ts
themeVariant?: "default" | "premium" | "championship";
presentationMode?: "viewer" | "admin";
```

단, 초기 구현에서는 기존 props만으로도 충분하다.

---

## 5.2 `components/draw/DrawAnimator.tsx`
### 해야 할 일
`kind === "stage3d"` 분기 추가

### 변경 방향
- 기존 `lotto`, `scoreboard` 유지
- `stage3d`일 때만 `Stage3DAnimator` 렌더
- 성능 이슈를 줄이기 위해 dynamic import 권장

### 구현 가이드
```tsx
const Stage3DAnimator = dynamic(
  () => import("./stage3d/Stage3DAnimator").then((m) => m.Stage3DAnimator),
  { ssr: false }
);
```

### 주의점
- window 의존성은 stage3d 내부로 한정
- import 시점에 three 관련 코드가 서버로 올라가지 않도록 주의

---

## 5.3 viewer 페이지 수정
현재 viewer draw 페이지에서 `DrawAnimator` 호출 시 `kind="scoreboard"` 또는 기존 kind를 넘기는 부분을 `stage3d`로 바꾸거나 feature flag로 분기한다.

### 권장 전략
초기에는 env flag 또는 상수 플래그로 분기:

```ts
const animatorKind: AnimatorKind = enableStage3D ? "stage3d" : "scoreboard";
```

### viewer 적용 원칙
- 기본은 stage3d
- lowSpecMode일 때는 내부에서 품질 조정
- 필요 시 아주 저성능 장치에서 scoreboard fallback 허용

---

## 5.4 admin 페이지 수정
admin draw 페이지도 동일하게 `DrawAnimator` kind 분기 적용

### admin 추가 정책
admin에서는 다음을 extra overlay로 표시 가능

- current phase
- startedAt 기준 진행률
- current pick candidate id
- group target
- fps / performance tier (디버그용)

이 정보는 production에서 숨기고 내부 플래그로만 노출할 수 있다.

---

## 6. 신규 파일 상세 설계

## 6.1 `components/draw/stage3d/types.ts`
### 목적
3D 전용 상태 타입 정의

### 권장 타입
```ts
export type StagePerformanceTier = "high" | "medium" | "low";

export type StagePhase =
  | "idle"
  | "configured"
  | "spinning"
  | "picked"
  | "assigning"
  | "finished";

export interface StageCandidateVisual {
  id: string;
  label: string;
  isWinner: boolean;
  isActive: boolean;
  isNearMiss: boolean;
  assignedGroupNo?: number | null;
  index: number;
}

export interface StageSceneState {
  phase: StagePhase;
  progress: number;
  winnerId?: string | null;
  targetGroupNo?: number | null;
  assignGroupNo?: number | null;
  performanceTier: StagePerformanceTier;
  candidates: StageCandidateVisual[];
}
```

---

## 6.2 `mapAnimatorPropsToStageState.ts`
### 목적
기존 `AnimatorProps`를 3D에서 쓰기 쉬운 구조로 변환

### 책임
- candidates 정규화
- `currentPickCandidateId` 기반 winner 판별
- `phase`를 stage 전용 phase로 매핑
- `lowSpecMode`를 performance tier 입력으로 넘김
- 필요한 경우 `presentationMode` 반영

### 핵심 규칙
- 이 함수는 순수 함수여야 한다.
- 랜덤 사용 금지
- 현재 시각에 의존하지 않는 정적 매핑만 담당

---

## 6.3 `useStageTimeline.ts`
### 목적
`startedAt`, `durationMs`, `stepSeed`, `stepTempo`, `phase`를 바탕으로 현재 재생 진행률 계산

### 출력 예시
```ts
{
  progress: number;          // 0 ~ 1
  elapsedMs: number;
  activeIndex: number | null;
  nearMissIndexes: number[];
  isSettled: boolean;
}
```

### 구현 규칙
- 매 프레임 current time 기준으로 계산
- winner가 확정된 phase에서는 해당 winner 쪽으로 수렴
- replay 도중 중간 진입해도 같은 상태가 재생되어야 함

### 주의점
- 여기서도 결과를 바꾸지 않는다.
- 현재 state를 시각적으로 어디까지 진행했는지 계산만 한다.

---

## 6.4 `usePerformanceTier.ts`
### 목적
실제 렌더링 품질 등급 계산

### 입력
- `lowSpecMode`
- `window.devicePixelRatio`
- viewport width
- optional fps probe

### 초기 정책
```ts
if (lowSpecMode) return "low";
if (mobile) return "medium";
return "high";
```

### 추후 확장
실측 fps 하락 시 자동 downgrade 가능

---

## 6.5 `Stage3DAnimator.tsx`
### 목적
전체 오케스트레이터

### 책임
- `AnimatorProps` 수신
- stage state 구성
- timeline hook 호출
- performance tier 결정
- scene + HUD 조합 렌더링

### 예상 구조
```tsx
export function Stage3DAnimator(props: AnimatorProps) {
  const performanceTier = usePerformanceTier(props.lowSpecMode);
  const baseState = mapAnimatorPropsToStageState(props, performanceTier);
  const timeline = useStageTimeline(props, baseState);
  const sceneState = useStageSceneState(baseState, timeline);

  return (
    <div className="relative h-full w-full overflow-hidden">
      <StageCanvas sceneState={sceneState} />
      <HudOverlay sceneState={sceneState} animatorProps={props} />
    </div>
  );
}
```

### 금지 사항
- 여기서 three object 직접 생성하지 말 것
- scene 관련 구현은 `StageCanvas` 이하로 분리

---

## 6.6 `StageCanvas.tsx`
### 목적
R3F `Canvas` 래퍼

### 책임
- Canvas 생성
- performance tier별 gl 설정
- camera / dpr / frameloop 정책
- Scene 마운트

### 권장 정책
- `dpr={[1, 1.5]}` 또는 tier별 차등
- `shadows`는 high/medium에서만
- 배경색, toneMapping, antialias 옵션 tier별 분기

---

## 6.7 `StageScene.tsx`
### 목적
실제 3D 오브젝트 트리 구성

### 포함 요소
- `EnvironmentFloor`
- `StageLighting`
- `CameraRig`
- `CandidateRing`
- `WinnerFocus`
- `GroupPodiums`
- `ParticleBursts`

### 책임
- sceneState를 각 서브 오브젝트에 전달
- 오브젝트 간 강결합 최소화
- 카메라 이동은 `CameraRig`에 위임

---

## 6.8 `CameraRig.tsx`
### 목적
phase에 맞는 카메라 shot 제어

### 권장 shot
- idle: wide
- configured: dolly-in
- spinning: orbit slow
- picked: focus close-up
- assigning: winner follow shot
- finished: wide reveal

### 구현 포인트
- 현재 카메라 상태와 목표 카메라 상태를 보간
- `useFrame`으로 매 프레임 부드럽게 이동
- low tier에서는 카메라 복잡도 축소

---

## 6.9 `StageLighting.tsx`
### 목적
phase 및 성능 등급에 따라 라이트 구성

### 권장 구성
- ambient light
- directional / spot light
- rim light 또는 accent light
- winner reveal 시 intensity 상승

### tier 정책
- high: 복수 라이트 + 애니메이션
- medium: 단순화
- low: static light + emissive 재질 중심

---

## 6.10 `CandidateRing.tsx`
### 목적
후보들을 원형/타원형 링 위에 배치하고 회전 연출 제공

### 입력
- candidates
- activeIndex
- nearMissIndexes
- winnerId
- phase
- progress

### 구현 방향
- `buildRingLayout`에서 각 후보의 target transform 계산
- spinning일 때는 global ring rotation + active 강조
- picked 이후 winner는 중앙으로 이탈

### 주의점
- 후보 수가 많아져도 layout이 깨지지 않아야 함
- 20명 이상에서도 최소 동작해야 함

---

## 6.11 `CandidateCard3D.tsx`
### 목적
후보의 기본 3D 표현

### 구성 요소
- plane / rounded card mesh
- front label
- glow edge
- depth / tilt

### 상태별 스타일
- background: dim
- active: glow up
- near miss: pulse
- winner: scale up + emissive highlight

### 구현 팁
초기에는 geometry를 단순화하고, 텍스트는 `Text` 또는 texture sprite 사용
후반에 카드 재질을 고급화한다.

---

## 6.12 `WinnerFocus.tsx`
### 목적
winner가 중앙으로 이동한 뒤 spotlight와 함께 강조되는 레이어

### 책임
- 중앙 승자 오브젝트 렌더
- picked phase에서 등장
- assign phase에서 target group으로 이동하기 전 전면 배치
- 하단 배너와 타이밍 맞춤

---

## 6.13 `GroupPodiums.tsx`
### 목적
조 배정 결과를 무대 위 공간 구조로 표현

### 설계
- group 번호별 pedestal 또는 gate 생성
- assign_confirm 시 winner가 해당 위치로 이동
- 이미 배정된 후보는 podium 주변에 정착 표시

### 데이터 요구
- 후보별 assignedGroupNo 계산 필요
- 이 값은 animator props 또는 기존 state에서 유도

---

## 6.14 `ParticleBursts.tsx`
### 목적
picked / assign_confirm 같은 이벤트성 순간 강조

### 정책
- high: particle burst 활성
- medium: reduced
- low: off

### 주의점
파티클은 반드시 시각 보조여야지, 핵심 정보를 가리면 안 된다.

---

## 6.15 `HudOverlay.tsx`
### 목적
3D 씬 위에 올리는 2D 정보 레이어

### 포함 요소
- lower third
- current phase label
- current winner name
- target group
- progress / currentStep / totalSteps
- 남은 후보 수
- optional realtime badge

### 구현 포인트
- absolute overlay
- pointer-events 최소화
- viewer/admin에서 일부 내용만 다르게 보이도록 가능

---

## 6.16 `LowerThird.tsx`
### 목적
방송 자막 느낌의 핵심 정보 바

### 표시 내용
- 현재 라운드 정보
- winner 명칭
- assign group
- 상태 문구

### 애니메이션
- configured: slide in
- picked: expand
- finished: settle

---

## 6.17 `StatusBadgeBar.tsx`
### 목적
상단 또는 구석에 작은 상태 배지 표시

### 용도
viewer:
- LIVE
- low spec
- current group

admin:
- debug mode
- current phase
- sync status

---

## 7. sceneState 조립 규칙

## 7.1 `useStageSceneState.ts`
### 목적
base state + timeline을 합쳐 최종 렌더링 상태를 만든다.

### 출력 예시
```ts
{
  phase,
  performanceTier,
  cameraShot,
  lightPreset,
  progress,
  activeIndex,
  nearMissIndexes,
  winnerId,
  targetGroupNo,
  assignGroupNo,
  candidates,
  hud: {
    title,
    subtitle,
    winnerName,
    statusText,
    stepText,
  }
}
```

### 규칙
- UI 문구는 여기서 조합 가능
- 3D와 HUD가 같은 truth source를 보게 함
- phase 전환 임계값을 중앙 관리

---

## 8. phase 매핑 상세 규칙

기존 `AnimatorProps.phase`가 정확히 어떤 문자열 집합인지 레포 구현에 맞춰 확인 후 연결해야 하지만,
상세 설계 기준 매핑은 아래처럼 둔다.

### idle 계열
- pending
- waiting
- before configured

### configured
- configured
- ready

### spinning
- pick 진행 중
- reveal 직전 active scan 중

### picked
- pick_result 직후
- winner 중심 연출 구간

### assigning
- assign_update
- assign_confirm

### finished
- round or flow finished

이 매핑은 실제 레포 문자열에 맞게 `computePhaseDirectives.ts`에서 명시적으로 작성한다.

---

## 9. viewer 연결 설계

## 9.1 적용 방식
viewer page에서 `DrawAnimator`에 전달하는 `kind`를 `stage3d`로 전환한다.

### 권장 절차
1. feature flag 도입
2. 내부 테스트에서만 stage3d 활성
3. 안정화 후 기본값 전환

## 9.2 viewer 레이아웃 권장 수정
현재 viewer 정보 패널이 너무 업무형이면 다음처럼 정리한다.

- 중앙 hero 높이 확대
- 채팅/그룹 패널은 하단 또는 측면 접이식
- HUD는 3D 씬 위 반투명 오버레이
- winner 순간엔 주변 UI를 잠시 약화

---

## 10. admin 연결 설계

## 10.1 적용 방식
admin page도 동일하게 `kind="stage3d"` 사용 가능

### admin 전용 차이
`presentationMode="admin"` optional prop을 추가해도 좋다.

효과:
- HUD를 더 작게
- 디버그 정보 표시
- 카메라 연출을 viewer보다 약하게
- 상단 운영 패널과 충돌 줄이기

## 10.2 admin UX 정책
- 조작 버튼은 기존 위치 유지
- 3D 프리뷰는 메인 시각 피드백
- 실수 방지를 위해 현재 phase와 타겟 group이 항상 보이게 함

---

## 11. 성능 상세 정책

## 11.1 티어별 차등
### high
- dpr 최대 1.5~2
- particle burst on
- bloom on
- animated lights on
- smoother camera lerp

### medium
- dpr 1~1.25
- reduced particles
- bloom 약화 또는 off
- limited shadow

### low
- dpr 1
- fixed light
- no post processing
- no particles
- simpler material
- reduced idle animation

## 11.2 fallback 정책
다음 조건 중 하나면 fallback 고려:

- lowSpecMode 강제 on
- 모바일 저성능 브라우저
- WebGL context 품질 불량
- fps 지속 하락

fallback 방식:
- stage3d 내부에서 low mode 유지
- 또는 scoreboard로 자동 전환
- 또는 simplified stage theme 사용

---

## 12. 스타일/아트 디렉션 가이드

## 12.1 기본 톤
추천 톤:

- dark premium stage
- neon accent
- soft glow
- reflective floor
- restrained but rich motion

## 12.2 피해야 할 것
- 과도한 색상 난립
- 텍스트 가독성 낮은 과한 bloom
- 캐릭터성 없는 기본 primitive 남발
- 게임 데모처럼 보이는 무의미한 카메라 회전
- 물리 엔진 중심의 장난감 느낌

## 12.3 winner 순간 강조
필수 요소:

- spotlight
- scale emphasis
- lower third 확장
- background dim
- 0.3~0.8초 내 임팩트 정점 형성

---

## 13. 데이터 요구사항 점검

초기 구현은 기존 props로 충분할 가능성이 높다.
다만 아래 값이 명확하지 않으면 보강 검토:

- candidate별 assigned group 유도 가능 여부
- phase enum의 실제 목록
- currentStep / totalSteps의 모든 화면 정의
- viewer/admin 공통에서 동일하게 쓰는 group snapshot

필요 시 optional prop 추가 또는 내부 selector 보강

---

## 14. 테스트 전략

## 14.1 단위 테스트
대상:
- `mapAnimatorPropsToStageState`
- `computeTimelineProgress`
- `buildRingLayout`
- `computeCameraShot`
- `computePhaseDirectives`

중점:
- deterministic output
- edge case handling
- large candidate count

## 14.2 통합 테스트
시나리오:
- viewer 중간 접속 replay
- admin pick 후 viewer 동기화
- assign_confirm 반영
- lowSpecMode 전환
- 모바일 viewport

## 14.3 수동 QA
반드시 체크:
- winner 불일치 없음
- phase 전환이 어색하지 않음
- 텍스트가 항상 읽힘
- 과도한 프레임 드랍 없음
- admin 운영성이 유지됨

---

## 15. 구현 순서 제안

## 15.1 Sprint 1
- 패키지 설치
- `AnimatorKind` 확장
- `DrawAnimator` 분기
- `Stage3DAnimator` / `StageCanvas` 뼈대
- 기본 무대 + 후보 배치

완료 기준:
- 후보 목록이 3D 링에 표시됨
- viewer/admin에서 렌더됨

## 15.2 Sprint 2
- timeline hook
- active/near-miss/winner 연출
- 카메라 shot
- basic HUD

완료 기준:
- spinning → picked 흐름이 동작
- winner가 명확히 보임

## 15.3 Sprint 3
- assign animation
- group podium
- lower third polish
- viewer 전용 시각 개선

완료 기준:
- 조 배정이 입체적으로 표현됨
- viewer가 쇼 화면처럼 보임

## 15.4 Sprint 4
- 성능 최적화
- lowSpec/mobile 정책
- admin debug overlay
- fallback 전략 보강

완료 기준:
- 실서비스 수준 안정성 확보

---

## 16. 초기 구현용 의사 코드

## 16.1 DrawAnimator
```tsx
switch (kind) {
  case "stage3d":
    return <Stage3DAnimator {...props} />;
  case "scoreboard":
    return <ScoreboardAnimator {...props} />;
  default:
    return <LottoAnimator {...props} />;
}
```

## 16.2 Stage3DAnimator
```tsx
export function Stage3DAnimator(props: AnimatorProps) {
  const performanceTier = usePerformanceTier(props.lowSpecMode);
  const baseState = useMemo(
    () => mapAnimatorPropsToStageState(props, performanceTier),
    [props, performanceTier]
  );

  const timeline = useStageTimeline(props, baseState);
  const sceneState = useStageSceneState(baseState, timeline);

  return (
    <div className="relative h-full w-full bg-black">
      <StageCanvas sceneState={sceneState} />
      <HudOverlay sceneState={sceneState} animatorProps={props} />
    </div>
  );
}
```

## 16.3 CandidateRing
```tsx
export function CandidateRing({ sceneState }: Props) {
  const layout = useMemo(
    () => buildRingLayout(sceneState.candidates.length),
    [sceneState.candidates.length]
  );

  return (
    <group rotation={[0, sceneState.ringRotationY, 0]}>
      {sceneState.candidates.map((candidate, idx) => (
        <CandidateCard3D
          key={candidate.id}
          candidate={candidate}
          transform={layout[idx]}
          phase={sceneState.phase}
        />
      ))}
    </group>
  );
}
```

---

## 17. 구현자가 반드시 지켜야 할 규칙

1. 추첨 결과를 3D 컴포넌트에서 결정하지 말 것  
2. stage state 계산은 가능한 순수 함수 + hook 조합으로 유지할 것  
3. 3D 씬과 HUD 상태 소스를 분리하지 말 것  
4. viewer/admin 공통 재사용을 우선할 것  
5. lowSpecMode는 마지막이 아니라 처음부터 반영할 것  
6. 디자인 욕심 때문에 텍스트 가독성을 희생하지 말 것  
7. “멋진 오브젝트”보다 “좋은 연출 타이밍”을 우선할 것  

---

## 18. 최종 결론

이 상세 설계의 핵심은 단 하나다.

> 기존 draw 시스템은 건드리지 않고,
> `DrawAnimator` 아래에 `Stage3DAnimator`라는 새 프레젠테이션 구현체를 추가해
> viewer/admin에서 동일한 draw state를 고급 3D 쇼 연출로 재생한다.

이 문서대로 구현하면,
현재의 조추첨 기능을 단순한 웹 애니메이션 수준이 아니라
**서비스의 상징적인 프리미엄 기능**으로 끌어올릴 수 있다.
