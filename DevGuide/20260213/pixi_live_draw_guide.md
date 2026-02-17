# PixiJS 기반 라이브 조추첨(룰렛/로또) 애니메이션 가이드
> Next.js(App Router) + Supabase + Vercel  
> PC/모바일 동시 시청(라이브) + 실시간 동기화(이벤트 스트리밍)  
> **목표:** 기존 DOM 기반 룰렛/로또(추첨기) 연출을 **PixiJS(WebGL)** 로 교체해 “게임 퀄리티”로 끌어올리기  
> **범위:** 룰렛/로또 둘 다 적용 가능한 공통 설계 + 구현 가이드(확장형 Animator 구조)

---

## 1) 결론 요약(왜 PixiJS인가)
DOM(div) + CSS로 물리/애니메이션을 만들면 “위젯 느낌”이 강해지고, 오브젝트 수가 늘면 성능·품질 모두에서 한계가 빨리 온다.  
PixiJS(WebGL)는 다음을 쉽게 해결한다.

- 스프라이트(공/휠/기계) 기반 **게임 같은 비주얼**
- 글로우/블러/드랍섀도우/파티클 등 **이펙트**
- 모바일에서 비교적 안정적인 **캔버스 렌더링**
- “연출만 교체”가 가능해서, Supabase 이벤트/상태 로직은 그대로 유지

> **핵심 전략:** 실시간 동기화(이벤트)는 그대로 두고, “렌더링/연출 레이어”만 PixiJS로 교체한다.

---

## 2) 기술 스택(권장 조합)

### 필수
- Next.js (Client Component에서 Pixi 캔버스 렌더)
- Supabase (DB + Realtime Broadcast)
- PixiJS (`pixi.js`)

### 선택(퀄리티/개발 편의)
- 애니메이션 타임라인: `gsap` 또는 직접 `ticker`
- 파티클: `@pixi/particle-emitter` (권장)
- 사운드: `@pixi/sound` 또는 HTML Audio
- 아트 리소스: PNG/WebP 스프라이트 + (가능하면) texture atlas

---

## 3) 설치

```bash
npm i pixi.js
# 선택 사항(추천)
npm i @pixi/particle-emitter @pixi/sound gsap
```

---

## 4) 아키텍처(공통 템플릿) — “Animator 플러그인 구조”
룰렛/로또가 늘어나도 **실시간 동기화/상태 모델은 동일**하게 유지하고,
연출만 교체 가능하도록 Animator 인터페이스를 둔다.

### 4.1 Animator 인터페이스(공통)
```ts
export type StepMode = "ROUND_ROBIN" | "TARGET_GROUP";

export type StepConfiguredPayload = {
  sessionId: string;
  step: number;
  mode: StepMode;
  targetGroupNo: number;   // 자동 추천 or 진행자 지정
  startedAt: number;       // ms epoch (서버 기준 시간)
  durationMs: number;      // 연출 길이
  remaining: Array<{ id: string; label: string }>; // 남은 사람(표시용)
  quality?: "auto" | "high" | "low";
};

export type PickResultPayload = {
  sessionId: string;
  step: number;
  playerId: string;
};

export type AssignConfirmedPayload = {
  sessionId: string;
  step: number;
  playerId: string;
  groupNo: number;
};

export interface Animator {
  mount(container: HTMLElement): void;
  resize(width: number, height: number): void;
  destroy(): void;

  onStepConfigured(payload: StepConfiguredPayload): void; // 룰렛/로또 준비 + 시작
  onPickResult(payload: PickResultPayload): void;         // 당첨자 공개(멈춤/강조)
  onAssignConfirmed(payload: AssignConfirmedPayload): void; // 조 박스 이동 연출(선택)
}
```

> 룰렛/로또 구현체는 위 인터페이스만 맞추면 교체 가능.  
> Realtime 이벤트 처리부는 “payload를 받아 animator 메서드 호출”만 수행.

---

## 5) PixiJS를 Next.js에 붙이는 방법(권장 패턴)

### 5.1 Client Component에서 Pixi App 생성
Pixi는 브라우저(캔버스)에서만 돌아가므로 `use client` 컴포넌트에서 초기화한다.

```tsx
"use client";

import { useEffect, useRef } from "react";

export function PixiStage({
  animator,
}: {
  animator: { mount: (el: HTMLElement) => void; destroy: () => void; resize: (w: number, h: number) => void };
}) {
  const ref = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    const el = ref.current!;
    animator.mount(el);

    const ro = new ResizeObserver(() => {
      const r = el.getBoundingClientRect();
      animator.resize(Math.max(1, Math.floor(r.width)), Math.max(1, Math.floor(r.height)));
    });
    ro.observe(el);

    return () => {
      ro.disconnect();
      animator.destroy();
    };
  }, [animator]);

  return <div ref={ref} className="w-full h-full" />;
}
```

### 5.2 SSR 이슈 회피 팁
- Pixi 관련 코드는 반드시 client component / `useEffect` 내부에서 실행
- 이미지/오디오 리소스는 public 폴더 사용 권장

---

## 6) 공통 품질 설계(룰렛/로또 모두 적용)

### 6.1 “텍스트는 오브젝트(공/휠) 안에 넣지 말고” 분리
- 공 안에는 **번호/아이콘**만(혹은 아주 짧은 텍스트)
- 이름/상세는 하단/우측 패널에 크게 표시
- 시청 UX에서 가독성이 폭발적으로 좋아진다

### 6.2 레이어 구조(게임 느낌의 핵심)
Pixi 컨테이너를 레이어로 나누자.

- `bgLayer` : 배경(그라데이션, 노이즈, 라이트)
- `machineLayer` : 추첨기 본체(휠/볼통/프레임)
- `actorLayer` : 공/섹터/텍스트(움직이는 요소)
- `fxLayer` : 파티클/글로우/플래시
- `uiLayer` : “이번은 7조 자리” 같은 텍스트(선택)

### 6.3 모바일 대응(필수)
- `resolution: devicePixelRatio`를 무조건 올리면 발열/메모리 ↑  
  → **quality 옵션**으로 조절하자.
- 권장:
  - `high`: resolution 2, 블러/파티클 on
  - `low`: resolution 1, 블러 off, 파티클 최소
  - `auto`: 화면 크기/기기 성능으로 결정

---

## 7) PixiJS 기본 셋업 코드(재사용)

아래는 “Animator 구현체”에서 공통으로 쓰기 좋은 베이스.

```ts
import * as PIXI from "pixi.js";

export type PixiAppOptions = {
  backgroundAlpha?: number;
  quality?: "auto" | "high" | "low";
};

export class PixiBase {
  app!: PIXI.Application;
  root!: PIXI.Container;

  bgLayer = new PIXI.Container();
  machineLayer = new PIXI.Container();
  actorLayer = new PIXI.Container();
  fxLayer = new PIXI.Container();
  uiLayer = new PIXI.Container();

  async mount(container: HTMLElement, options?: PixiAppOptions) {
    const quality = options?.quality ?? "auto";

    const resolution =
      quality === "high" ? Math.min(2, window.devicePixelRatio || 1) :
      quality === "low"  ? 1 :
      Math.min(2, window.devicePixelRatio || 1);

    this.app = new PIXI.Application();
    await this.app.init({
      resizeTo: container,
      antialias: true,
      backgroundAlpha: options?.backgroundAlpha ?? 0,
      resolution,
      autoDensity: true,
      powerPreference: "high-performance",
    });

    container.appendChild(this.app.canvas);
    this.root = new PIXI.Container();
    this.app.stage.addChild(this.root);

    this.root.addChild(this.bgLayer, this.machineLayer, this.actorLayer, this.fxLayer, this.uiLayer);
  }

  resize(_width: number, _height: number) {
    // resizeTo 사용 시 Pixi가 캔버스 사이즈를 관리.
    // 필요하면 각 레이어의 중앙 정렬/스케일 등을 여기서 처리.
  }

  destroy() {
    try {
      if (this.app) this.app.destroy(true);
    } catch {}
  }
}
```

---

# 8) 룰렛 Animator (PixiRouletteAnimator) 가이드

## 8.1 룰렛 연출 요구사항
- remaining pool(남은 사람)을 매 스텝마다 반영
- 스텝 시작 시 “이번은 X조 자리(자동/지정)” 표시 가능
- `PICK_RESULT` 도착 전까지는 결과를 노출하지 않음
- `PICK_RESULT` 도착 시 룰렛이 자연스럽게 멈추고 당첨 강조

## 8.2 룰렛 구현 방식(권장)
**DOM conic-gradient** 대신 Pixi에서 다음 중 하나를 선택:

### A안(추천) — “휠 이미지 + 텍스트”
- 기본 휠은 고퀄 PNG/WebP(프레임/재질 포함)
- 섹션 텍스트는 Pixi `Text`로 배치하되, 너무 많으면 “번호만” 표시
- 휠 회전은 컨테이너 `rotation`만 돌리면 됨

### B안 — “섹터를 그래픽으로 직접 그리기”
- `PIXI.Graphics`로 부채꼴을 그려 섹터 생성
- 텍스처/그라데이션을 얹으려면 추가 작업 필요

> 고퀄은 A안이 더 빠르다(디자인 리소스만 있으면).

## 8.3 룰렛 회전/감속(타임라인)
- `STEP_CONFIGURED` 수신 → 회전 시작
- `PICK_RESULT` 수신 → “당첨 섹터” 각도 계산 → 자연스럽게 감속하여 멈춤

### 각도 계산 팁
- remaining 배열의 index가 `i`일 때, 섹터 중앙 각도:
  - `sectorAngle = (2π) / N`
  - `targetAngle = i * sectorAngle + sectorAngle/2`
- 포인터가 위쪽(0 라디안)이라고 가정하면,
  - 휠 rotation을 `-targetAngle`로 맞추면 해당 섹터가 포인터에 온다
- 실제로는 “여러 바퀴 더 돈 뒤” 멈추는 게 맛이 좋음:
  - `finalRotation = currentRotation + (2π * k) + deltaToTarget`

## 8.4 룰렛 최소 구현 스켈레톤(개념)
```ts
import * as PIXI from "pixi.js";
import { PixiBase } from "./PixiBase";
import type { Animator, StepConfiguredPayload, PickResultPayload, AssignConfirmedPayload } from "./AnimatorTypes";

export class PixiRouletteAnimator extends PixiBase implements Animator {
  private wheel = new PIXI.Container();
  private labels: PIXI.Text[] = [];
  private current?: StepConfiguredPayload;
  private spinning = false;

  async mount(container: HTMLElement) {
    await super.mount(container, { backgroundAlpha: 0, quality: "auto" });
    this.actorLayer.addChild(this.wheel);
  }

  onStepConfigured(payload: StepConfiguredPayload) {
    this.current = payload;
    this.spinning = true;

    // 라벨 재생성 (이름 대신 번호/짧은 라벨 권장)
    for (const t of this.labels) t.destroy();
    this.labels = [];

    const N = payload.remaining.length;
    const radius = 180;
    for (let i = 0; i < N; i++) {
      const angle = (i / N) * Math.PI * 2 - Math.PI / 2;
      const text = new PIXI.Text({
        text: payload.remaining[i].label,
        style: new PIXI.TextStyle({ fontSize: 16, fill: 0xffffff })
      });
      text.anchor.set(0.5);
      text.x = Math.cos(angle) * (radius * 0.65);
      text.y = Math.sin(angle) * (radius * 0.65);
      this.wheel.addChild(text);
      this.labels.push(text);
    }

    this.app.ticker.add(this.tickSpin);
  }

  private tickSpin = (delta: number) => {
    if (!this.spinning) return;
    this.wheel.rotation += 0.12 * (delta / 1);
  };

  onPickResult(_payload: PickResultPayload) {
    // TODO: 목표 각도 계산 후 감속하여 멈춤 + 당첨 강조(FX)
    this.spinning = false;
    this.app.ticker.remove(this.tickSpin);
  }

  onAssignConfirmed(_payload: AssignConfirmedPayload) {
    // 조 박스 이동 연출(선택)
  }
}
```

> 실제 “감속/멈춤”은 gsap 타임라인을 추천(훨씬 자연스러움).

---

# 9) 로또(볼 추첨기) Animator (PixiLottoAnimator) 가이드

## 9.1 로또 연출 요구사항(조편성용)
- remaining pool에서 1명을 뽑는다(볼로 표현)
- `PICK_RESULT` 이전엔 당첨자 노출 없음
- `PICK_RESULT`가 오면: 특정 볼이 배출/팝업/강조
- 이후 `ASSIGN_CONFIRMED` 시 조 박스로 이동(선택)

## 9.2 로또 구현 권장 방식 — “가짜 물리(연출)”
- 많은 충돌 물리는 지저분해지고 모바일에서 성능 문제
- 대신 “섞이는 느낌”만 주는 가벼운 움직임 + 결과 시점에 볼을 연출로 배출

## 9.3 로또 최소 스켈레톤(개념)
```ts
import * as PIXI from "pixi.js";
import { PixiBase } from "./PixiBase";
import type { Animator, StepConfiguredPayload, PickResultPayload, AssignConfirmedPayload } from "./AnimatorTypes";

type Ball = { id: string; sprite: PIXI.Sprite; vx: number; vy: number };

export class PixiLottoAnimator extends PixiBase implements Animator {
  private balls: Ball[] = [];
  private mixing = false;

  async mount(container: HTMLElement) {
    await super.mount(container, { backgroundAlpha: 0, quality: "auto" });
  }

  onStepConfigured(payload: StepConfiguredPayload) {
    this.mixing = true;

    // 기존 정리
    for (const b of this.balls) b.sprite.destroy();
    this.balls = [];

    // 너무 많으면 지저분 → 일부만 시각화(8~12 추천)
    const showCount = Math.min(payload.remaining.length, 12);

    for (let i = 0; i < showCount; i++) {
      const p = payload.remaining[i];

      const s = PIXI.Sprite.from("/assets/ball.webp");
      s.anchor.set(0.5);
      s.x = (Math.random() - 0.5) * 240;
      s.y = (Math.random() - 0.5) * 140;
      s.scale.set(0.55);

      this.actorLayer.addChild(s);
      this.balls.push({ id: p.id, sprite: s, vx: (Math.random()-0.5)*6, vy: (Math.random()-0.5)*6 });
    }

    this.app.ticker.add(this.tickMix);
  }

  private tickMix = (delta: number) => {
    if (!this.mixing) return;
    const left = -260, right = 260, top = -160, bottom = 160;

    for (const b of this.balls) {
      b.sprite.x += b.vx * (delta / 1);
      b.sprite.y += b.vy * (delta / 1);
      if (b.sprite.x < left || b.sprite.x > right) b.vx *= -1;
      if (b.sprite.y < top || b.sprite.y > bottom) b.vy *= -1;
    }
  };

  onPickResult(payload: PickResultPayload) {
    // 결과가 오기 전엔 노출 금지 → 결과 도착 시 강조/배출 연출
    this.mixing = false;
    this.app.ticker.remove(this.tickMix);

    // 시각화한 공 중에 없을 수 있음 → 강조용 공을 새로 생성해 배출구로 이동시키는 방식 추천
    const winner = PIXI.Sprite.from("/assets/ball_winner.webp");
    winner.anchor.set(0.5);
    winner.x = 0; winner.y = 0;
    winner.scale.set(0.2);
    this.fxLayer.addChild(winner);

    // TODO: gsap으로 pop + glow + 파티클
  }

  onAssignConfirmed(_payload: AssignConfirmedPayload) {}
}
```

---

# 10) 룰렛/로또 공통 — 실시간 이벤트 연결

## 10.1 이벤트 수신 → animator 호출(공통)
```ts
function handleEvent(ev: { type: string; payload: any }) {
  // 1) 상태 업데이트(reducer)
  // state = reduce(state, ev);

  // 2) 애니메이션 업데이트
  switch (ev.type) {
    case "STEP_CONFIGURED":
      animator.onStepConfigured(ev.payload);
      break;
    case "PICK_RESULT":
      animator.onPickResult(ev.payload);
      break;
    case "ASSIGN_CONFIRMED":
      animator.onAssignConfirmed(ev.payload);
      break;
  }
}
```

## 10.2 타이밍 동기화(필수)
- `STEP_CONFIGURED.startedAt` 기준으로 재생 시작점을 맞춘다.
- 늦게 들어온 사용자는 `now - startedAt` 만큼 진행된 시점으로 “점프”하거나, 애니메이션을 압축 재생한다.

---

# 11) 리소스(아트) 준비(퀄리티의 80%)
권장 최소 리소스(3~5개로 시작 가능):
- `/public/assets/ball.webp`
- `/public/assets/ball_winner.webp`
- `/public/assets/shadow_soft.webp`
- `/public/assets/glass_overlay.webp`
- `/public/assets/roulette_frame.webp`

> 최소 3장만 있어도 체감이 확 바뀜: **ball + shadow + glass_overlay**

---

# 12) 성능/모바일 품질 옵션(권장)
- `high`: resolution 2, 파티클/글로우 on
- `low`: resolution 1, 파티클 최소/블러 off, 오브젝트 수 제한
- `auto`: 화면/기기 기반 자동

---

# 13) 구현 순서(추천 로드맵)
1) PixiStage + PixiBase 구축(마운트/리사이즈/해제 안정화)  
2) 룰렛 또는 로또 중 1개를 Pixi로 먼저 완성(리소스 3장만으로 시작)  
3) Realtime 이벤트 흐름에 연결(타이밍 동기화 포함)  
4) 두 번째 연출(룰렛/로또) 추가  
5) 파티클/사운드/글로우로 “당첨 순간” 완성  
6) Low 품질 옵션 도입(모바일 관전 최적화)

---

## 14) 체크리스트(완성 기준)
- [ ] 룰렛/로또 모두 `STEP_CONFIGURED → PICK_RESULT → ASSIGN_CONFIRMED`가 동작
- [ ] `PICK_RESULT` 이전에는 결과가 화면에 노출되지 않음
- [ ] 모바일에서 low 모드로 발열/프레임 드랍 없이 시청 가능
- [ ] Animator 인터페이스로 연출 교체/추가가 가능
