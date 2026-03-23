# JustGolf 라이브 조추첨 3D 업그레이드 아키텍처 설계

## 1. 문서 목적

이 문서는 `WEB_JustGolf` 레포의 라이브 조추첨 기능을 고수준 3D 연출 시스템으로 업그레이드하기 위한 상위 아키텍처 설계 문서다.

목표는 다음과 같다.

- 기존 추첨 로직, 실시간 동기화, 리플레이 구조를 유지한다.
- 애니메이션/연출 레이어만 교체 가능한 구조로 확장한다.
- 관리자 화면과 시청자 화면에서 동일한 draw state를 기반으로 일관된 결과를 재생한다.
- 단순한 캔버스 효과가 아니라, 실제 서비스 품질의 3D 무대형 연출을 구현한다.
- 이후 구현자가 이 문서를 기반으로 상세 설계와 실제 코딩으로 바로 이어갈 수 있도록 한다.

---

## 2. 현재 시스템에 대한 판단

### 2.1 유지해야 하는 것
현재 레포는 아래 계층이 이미 성숙해 있다.

- draw session / draw events 기반의 상태 관리
- 관리자 페이지에서의 제어 흐름
- 시청자 페이지에서의 실시간 구독 및 리플레이
- `AnimatorProps`를 통한 애니메이터 입력 계약
- `DrawAnimator` 호스트를 통한 애니메이터 구현체 교체 구조
- lowSpecMode 등 성능 분기 개념

즉, 추첨 결과를 결정하는 로직이나 이벤트 저장 방식이 문제가 아니라, **현재 연출 레이어가 목표 품질에 미치지 못하는 것**이 핵심이다.

### 2.2 교체해야 하는 것
교체 대상은 다음이다.

- 현재 `scoreboard` / `lotto` 중심의 연출 구현체
- draw 화면의 무대형 프레젠테이션 레이어
- viewer 화면의 비주얼 몰입감
- admin 화면의 프리뷰 표현 방식

### 2.3 교체하지 말아야 하는 것
아래는 가능하면 유지한다.

- DB 스키마
- draw events 저장 구조
- reducer / replay 체계
- 관리자 액션 방식
- viewer 실시간 구독 구조
- candidate 데이터 구조의 큰 틀

---

## 3. 설계 원칙

## 3.1 결과 결정과 결과 표현을 엄격히 분리
3D 애니메이터는 결과를 결정하지 않는다.

- 누가 선택되었는지
- 몇 조로 배정되는지
- 어느 시점에 pick_result가 확정되는지

이런 정보는 기존 서버 권위 흐름과 현재 draw state를 따른다.

3D는 오직 **이미 결정된 상태를 설득력 있게 보여주는 역할**만 맡는다.

## 3.2 3D 무대와 2D HUD를 분리
텍스트, 상태 배지, 조 정보, 진행도는 2D HUD가 담당한다.

3D 씬은 아래를 담당한다.

- 무대
- 카메라
- 후보 시각화
- 포커스 대상 강조
- 조 배정 이동
- 파티클/조명/공간감

이 분리를 지키지 않으면 정보 가독성과 연출 완성도가 동시에 무너진다.

## 3.3 관리자 화면과 시청자 화면의 목적을 분리
viewer는 쇼 연출 중심이다.
admin은 운영성과 제어성이 우선이다.

따라서 같은 엔진을 쓰더라도 구성은 다르게 한다.

- viewer: 풀 연출
- admin: 제어 패널 + 프리뷰 중심

## 3.4 저사양 분기를 처음부터 고려
3D 업그레이드는 반드시 성능 등급을 나눠야 한다.

- high: full stage, particles, post FX
- medium: reduced lights, simpler materials
- low: simplified scene, no heavy post FX
- mobile fallback: 2.5D 또는 경량 3D

---

## 4. 목표 사용자 경험

## 4.1 viewer UX 목표
시청자 화면은 “추첨 관리 화면”이 아니라 “라이브 쇼 화면”이어야 한다.

요구 수준:

- 대기 상태에서도 무대가 살아 있어야 함
- 추첨 시작 시 카메라/조명/브랜딩이 함께 반응
- 후보들이 단순 리스트가 아니라 연출 오브젝트로 느껴져야 함
- winner 확정 순간에 시각적 임팩트가 있어야 함
- 조 배정 시 이동 경로와 결과 정착이 명확해야 함
- 하단 HUD는 방송 자막처럼 읽히고 예뻐야 함

## 4.2 admin UX 목표
관리자 화면은 조작 가능성이 우선이다.

요구 수준:

- 모든 제어 패널은 지금처럼 빠르게 동작
- 3D 프리뷰는 viewer와 동일한 결과를 미리 볼 수 있어야 함
- 디버그/상태 표시가 viewer보다 더 풍부해야 함
- 저사양 모드 전환 가능
- 운영 중 실수 없이 pick/assign을 진행 가능

---

## 5. 권장 기술 스택

## 5.1 핵심 권장안
다음 조합을 권장한다.

- `three`
- `@react-three/fiber`
- `@react-three/drei`
- `framer-motion`
- 선택: `@react-three/postprocessing`
- 선택: `rive-react`

## 5.2 각 기술의 역할

### React Three Fiber
3D 무대, 카메라, 후보 오브젝트, 조명, 애니메이션, 씬 구성 담당

### Drei
카메라 컨트롤, 텍스트, 환경 프리셋, 유틸 컴포넌트 보강

### Framer Motion
HUD, 배너, 상태 오버레이, winner 패널, lower third 전환 담당

### Rive
필수는 아니지만, 고급 브랜딩 프레임/인트로/패널 전환에 강하다.
브로드캐스트 감성의 연출이 필요하면 적극 고려한다.

---

## 6. 상위 시스템 구조

```text
Draw Session / Draw Events / Replay / Subscriptions
                    |
                    v
             Draw State / Reducer
                    |
                    v
              AnimatorProps Adapter
                    |
        +-----------+-----------+
        |                       |
        v                       v
  Stage3DAnimator          Existing Animators
        |
        +---------------------------+
        |                           |
        v                           v
    Stage Scene                HUD Overlay
        |                           |
        v                           v
  3D Object Graph            2D Broadcast Layer
```

핵심은 `AnimatorProps Adapter`와 `Stage3DAnimator`다.

---

## 7. Stage3DAnimator 개념 설계

## 7.1 책임
`Stage3DAnimator`의 책임은 다음이다.

- `AnimatorProps`를 입력받는다.
- 현재 draw phase를 분석한다.
- deterministic timeline을 계산한다.
- 해당 상태를 3D 씬과 HUD에 분배한다.
- viewer/admin에서 공통으로 재사용된다.

## 7.2 입력
입력은 기존 `AnimatorProps` 계약을 그대로 사용한다.

주요 활용 필드:

- `phase`
- `mode`
- `targetGroupNo`
- `assignGroupNo`
- `durationMs`
- `startedAt`
- `currentPickCandidateId`
- `candidates`
- `stepSeed`
- `stepPattern`
- `stepTempo`
- `currentStep`
- `totalSteps`
- `lowSpecMode`

## 7.3 출력
출력은 두 방향이다.

- 3D Stage Scene state
- HUD Overlay state

예시:

- activeCandidateIds
- focusedCandidateId
- winnerCandidate
- progress
- cameraPreset
- lightingPreset
- announcementText
- groupAssignmentTarget

---

## 8. 연출 콘셉트 제안

## 8.1 무대형 3D 연출
추천하는 기본 테마는 다음과 같다.

- 어두운 무대 바닥
- 중앙 spotlight zone
- 원형 또는 타원형 후보 링
- 후보 카드 또는 구체형 토큰
- 외곽에 group podium 또는 gate
- winner reveal 시 전면 pull-in
- assign 시 특정 조로의 fly-to

## 8.2 후보 표현
후보는 텍스트만 띄우는 것이 아니라, 다음 중 하나를 선택한다.

### 안 1. 카드형
- 이름
- 번호
- subtle emissive edge
- front-facing 회전

### 안 2. 토큰형
- 구형 또는 배지형
- 전면 텍스트 라벨
- 이동 연출에 강함

### 안 3. 하이브리드
- 평상시 토큰형
- 포커스 시 카드형 확장

실무적으로는 하이브리드가 가장 고급스럽다.

---

## 9. phase별 연출 규칙

## 9.1 idle / pending
- 무대는 은은하게 살아 있음
- HUD는 대기 상태 메시지 표시
- 카메라는 와이드 샷
- 후보는 약한 idle motion만 유지

## 9.2 configured
- 카메라가 중앙으로 진입
- 후보 링이 나타나며 정렬
- 조명 밝기 상승
- lower third에 이번 라운드 정보 표시

## 9.3 spinning
- 후보 링 회전
- active window를 따라 하이라이트 이동
- near miss 후보는 약하게 흔들리거나 pulse
- 카메라는 orbit 또는 dolly motion

## 9.4 picked
- winner 후보가 중앙으로 튀어나옴
- background dim
- spotlight 집중
- 파티클 burst
- 이름/조 정보 HUD 확대

## 9.5 assign_update / assign_confirm
- winner가 지정된 group podium으로 이동
- 해당 조 슬롯에 정착
- 이전 결과와 함께 조 라인업을 시각적으로 쌓음

## 9.6 finished
- 전체 그룹 결과를 와이드 뷰로 보여줌
- HUD는 완료 배너 표시
- viewer는 종료 모션, admin은 다음 단계 제어 가능

---

## 10. viewer / admin 별 아키텍처 정책

## 10.1 viewer
viewer는 풀스크린 중심 구성으로 간다.

권장 레이아웃:

- 상단: minimal status bar
- 중앙: Stage3DAnimator hero 영역
- 하단: lower third + 현재 결과/진행도
- 측면 또는 접이식 패널: 그룹 현황 / 남은 후보 / 채팅

## 10.2 admin
admin은 운영 패널을 유지한다.

권장 레이아웃:

- 상단: 제어 패널
- 좌측/상단: 운영 버튼 및 상태
- 메인 프리뷰: Stage3DAnimator
- 우측 또는 하단: draw state 디버그 / 현재 조 현황

---

## 11. 성능 전략

## 11.1 렌더링 등급
반드시 세 단계 이상으로 분기한다.

### High
- dynamic lights
- bloom/post FX
- particle burst
- smooth camera animation
- richer material

### Medium
- reduced particles
- fewer post effects
- limited shadow
- simpler environment

### Low
- static environment
- no heavy post FX
- fixed camera presets
- reduced object count / simplified material

## 11.2 모바일 정책
모바일은 다음 둘 중 하나를 선택한다.

- 경량 3D 유지
- 2.5D fallback 제공

브랜드 목표가 강하고 viewer가 대형 화면 중심이라면, 모바일은 2.5D fallback도 합리적이다.

---

## 12. 상태 일관성 전략

## 12.1 deterministic playback
3D 애니메이터는 항상 다음 기준으로 움직여야 한다.

- 서버 또는 reducer가 이미 확정한 state
- `startedAt`
- `durationMs`
- `stepSeed`
- `stepPattern`
- `stepTempo`

즉 현재 상태를 표현할 뿐, 자체 RNG로 winner를 뽑지 않는다.

## 12.2 replay 가능성 유지
viewer가 새로 접속해도 기존 event replay를 통해 같은 연출 시점으로 들어와야 한다.

이를 위해 timeline 계산을 컴포넌트 내부 즉흥 상태가 아니라,
가능하면 순수 함수 계층으로 분리한다.

---

## 13. 프로젝트 구조 권장안

```text
components/
  draw/
    DrawAnimator.tsx
    types.ts
    stage3d/
      Stage3DAnimator.tsx
      StageScene.tsx
      CameraRig.tsx
      StageLighting.tsx
      CandidateRing.tsx
      CandidateCard3D.tsx
      WinnerPodium.tsx
      AssignmentPath.tsx
      Particles.tsx
      HudOverlay.tsx
      BroadcastFrame.tsx
      hooks/
        useStageTimeline.ts
        useStageSceneState.ts
        usePerformanceTier.ts
      lib/
        mapAnimatorPropsToStageState.ts
        buildCandidateLayout.ts
        computePhaseDirectives.ts
        computeCameraDirectives.ts
```

---

## 14. 단계별 개발 전략

## 단계 1. 엔진 도입
- R3F 기반 `Stage3DAnimator` 틀 추가
- `AnimatorKind` 확장
- `DrawAnimator` 분기 추가

## 단계 2. 최소 동작 씬
- 바닥
- 카메라
- 후보 배치
- currentPick 강조
- winner reveal

## 단계 3. phase 연출
- idle
- configured
- spinning
- picked
- assign_confirm
- finished

## 단계 4. HUD / 브랜딩
- lower third
- 결과 배너
- 그룹 진행 표시
- 정보 패널 모션 정리

## 단계 5. 성능/모바일/운영 안정화
- lowSpecMode 연동
- viewer/admin 시나리오 점검
- replay 일치성 검증
- large candidate count 검증

---

## 15. 성공 기준

다음이 만족되면 아키텍처 성공으로 본다.

- 기존 draw logic 변경 없이 3D 애니메이터가 통합된다.
- admin과 viewer가 동일한 draw state를 재생한다.
- winner/assign 결과가 절대 불일치하지 않는다.
- viewer 화면이 기존보다 명확히 “쇼 연출”로 느껴진다.
- lowSpecMode와 모바일에서도 깨지지 않는다.
- 향후 테마 교체 또는 스킨 작업이 가능하다.

---

## 16. 최종 결론

이 프로젝트의 핵심은 3D 기술을 “추가”하는 것이 아니라,  
**기존 draw 시스템 위에 연출 전용 프레젠테이션 레이어를 새로 올리는 것**이다.

추천 방향은 다음 한 문장으로 요약된다.

> `DrawAnimator` 아래에 `Stage3DAnimator`를 새 구현체로 추가하고,
> 3D Stage와 2D HUD를 분리한 하이브리드 구조로 viewer/admin 연출을 업그레이드한다.

이 방식이 현재 레포 구조와 가장 잘 맞고,  
실제 서비스 품질의 고수준 결과물로 이어질 가능성이 가장 높다.
