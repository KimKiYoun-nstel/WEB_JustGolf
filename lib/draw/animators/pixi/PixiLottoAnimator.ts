import { Bodies, Body, Composite, Engine, World } from "matter-js";
import { Container, Graphics, Text, TextStyle } from "pixi.js";
import { PixiBase } from "./PixiBase";
import type {
  AnimatorQuality,
  AssignConfirmedPayload,
  CandidateItem,
  PickResultPayload,
  PixiAnimator,
  PixiFrameState,
  StepConfiguredPayload,
} from "./types";

type BallEntity = {
  candidate: CandidateItem;
  body: Body;
  container: Container;
  shadow: Graphics;
  bubble: Graphics;
  token: Text;
  mini: Text;
  baseTint: number;
  styleKey: string;
  hidden: boolean;
};

type Geometry = {
  width: number;
  height: number;
  cx: number;
  cy: number;
  radius: number;
  outletX: number;
  outletY: number;
};

type CursorSettleState = {
  startTs: number;
  durationMs: number;
  fromCursor: number;
  toCursor: number;
};

type MotionSettleState = {
  startTs: number;
  durationMs: number;
};

type FlightState = {
  startTs: number;
  durationMs: number;
  fromX: number;
  fromY: number;
  toX: number;
  toY: number;
};

type BurstState = {
  startTs: number;
  durationMs: number;
};

type SparkState = {
  node: Graphics;
  startTs: number;
  durationMs: number;
  fromX: number;
  fromY: number;
  vx: number;
  vy: number;
};

type PixiLottoAnimatorOptions = {
  quality: AnimatorQuality;
  onFrame?: (frame: PixiFrameState) => void;
};

const BALL_TINTS = [0x1d4ed8, 0x0891b2, 0x0284c7, 0x2563eb, 0x0ea5e9, 0x4f46e5];

function clamp(value: number, min: number, max: number) {
  return Math.max(min, Math.min(max, value));
}

function lerp(from: number, to: number, t: number) {
  return from + (to - from) * t;
}

function easeOutCubic(t: number) {
  return 1 - (1 - t) ** 3;
}

function easeInOutCubic(t: number) {
  if (t < 0.5) return 4 * t * t * t;
  return 1 - ((-2 * t + 2) ** 3) / 2;
}

function wrapIndex(index: number, length: number) {
  if (length <= 0) return 0;
  return ((index % length) + length) % length;
}

function compactBallNumber(index: number) {
  return String(index + 1).padStart(2, "0");
}

function shortText(label: string, max = 8) {
  return Array.from(label.trim()).slice(0, max).join("");
}

function randomInRange(min: number, max: number) {
  return min + Math.random() * (max - min);
}

function clearChildren(container: Container) {
  const removed = container.removeChildren();
  removed.forEach((child) => child.destroy({ children: true }));
}

function drawBubble(target: Graphics, color: number, winner = false, radius = 22) {
  const highlight = Math.max(5, Math.round(radius * 0.3));
  target
    .clear()
    .circle(0, 0, radius)
    .fill({ color, alpha: winner ? 1 : 0.95 })
    .stroke({ color: winner ? 0xfef08a : 0xffffff, width: winner ? 3 : 2, alpha: 0.95 })
    .circle(-radius * 0.34, -radius * 0.34, highlight)
    .fill({ color: 0xffffff, alpha: winner ? 0.42 : 0.24 });
}

export class PixiLottoAnimator extends PixiBase implements PixiAnimator {
  private readonly quality: AnimatorQuality;
  private readonly onFrame?: (frame: PixiFrameState) => void;

  private readonly chamber = new Container();
  private readonly chamberRotor = new Graphics();
  private chamberMask: Graphics | null = null;
  private readonly winnerLayer = new Container();
  private readonly winnerShadow = new Graphics();
  private readonly winnerBubble = new Graphics();
  private readonly winnerPlate = new Graphics();
  private readonly winnerToken = new Text({
    text: "",
    style: new TextStyle({
      fontFamily: "Pretendard, SUIT, Noto Sans KR, sans-serif",
      fontSize: 26,
      fontWeight: "900",
      fill: 0x0f172a,
    }),
  });
  private readonly winnerLabel = new Text({
    text: "",
    style: new TextStyle({
      fontFamily: "Pretendard, SUIT, Noto Sans KR, sans-serif",
      fontSize: 11,
      fontWeight: "800",
      fill: 0x1e293b,
    }),
  });
  private readonly winnerRing = new Graphics();
  private readonly dockFront = new Graphics();
  private readonly topBanner = new Text({
    text: "",
    style: new TextStyle({
      fontFamily: "Pretendard, SUIT, Noto Sans KR, sans-serif",
      fontSize: 14,
      fontWeight: "700",
      fill: 0x334155,
    }),
  });

  private engine: Engine | null = null;
  private chamberWalls: Body[] = [];
  private balls: BallEntity[] = [];
  private candidateIndexById = new Map<string, number>();
  private geometry: Geometry | null = null;
  private remaining: CandidateItem[] = [];

  private spinning = false;
  private phaseLocked = false;
  private startAt = 0;
  private durationMs = 3500;
  private spinCursor = 0;
  private winnerId: string | null = null;
  private winnerName: string | null = null;
  private winnerDocked = false;
  private publishTs = 0;

  private cursorSettle: CursorSettleState | null = null;
  private motionSettle: MotionSettleState | null = null;
  private flight: FlightState | null = null;
  private burst: BurstState | null = null;
  private sparks: SparkState[] = [];
  private rotorSpeed = 0;

  constructor(options: PixiLottoAnimatorOptions) {
    super();
    this.quality = options.quality;
    this.onFrame = options.onFrame;
  }

  async mount(container: HTMLElement) {
    await super.mount(container, this.quality);
    if (!this.app) return;

    this.engine = Engine.create({ gravity: { x: 0, y: 0 } });
    this.chamber.sortableChildren = true;
    this.actorLayer.addChild(this.chamberRotor, this.chamber);

    this.winnerShadow
      .clear()
      .ellipse(0, 13, 22, 7)
      .fill({ color: 0x0f172a, alpha: 0.15 });
    drawBubble(this.winnerBubble, 0xfbbf24, true, 19);
    this.winnerPlate
      .clear()
      .roundRect(-34, 16, 68, 16, 8)
      .fill({ color: 0xf8fafc, alpha: 0.95 })
      .stroke({ color: 0xd1dbe9, width: 1.5, alpha: 0.95 });
    this.winnerToken.style.fontSize = 22;
    this.winnerToken.anchor.set(0.5, 0.6);
    this.winnerLabel.anchor.set(0.5, 0.5);
    this.winnerLabel.position.set(0, 24);
    this.winnerLabel.visible = false;
    this.winnerLayer.addChild(
      this.winnerShadow,
      this.winnerBubble,
      this.winnerPlate,
      this.winnerToken,
      this.winnerLabel
    );
    this.winnerLayer.visible = false;
    this.winnerRing.visible = false;
    this.dockFront.visible = true;

    this.fxLayer.addChild(this.winnerRing, this.winnerLayer, this.dockFront);
    this.topBanner.anchor.set(0.5);
    this.uiLayer.addChild(this.topBanner);

    this.app.ticker.add(this.tick);
    this.resize(container.clientWidth, container.clientHeight);
  }

  resize(width: number, height: number) {
    if (!this.app) return;
    super.resize(width, height);
    this.drawMachine(width, height);
    this.rebuildPhysicsScene();
  }

  destroy() {
    if (this.app) this.app.ticker.remove(this.tick);
    this.clearPhysics();
    this.engine = null;
    this.balls = [];
    this.remaining = [];
    this.candidateIndexById.clear();
    this.geometry = null;
    this.chamberMask = null;
    this.sparks = [];
    super.destroy();
  }

  onStepConfigured(payload: StepConfiguredPayload) {
    this.spinning = payload.active ?? true;
    this.phaseLocked = !this.spinning;
    this.startAt = payload.startedAt;
    this.durationMs = clamp(payload.durationMs, 1000, 15000);
    this.remaining = payload.remaining;
    this.candidateIndexById = new Map(
      payload.remaining.map((candidate, index) => [candidate.id, index])
    );
    this.spinCursor = this.remaining.length > 0 ? randomInRange(0, this.remaining.length) : 0;
    this.winnerId = null;
    this.winnerName = null;
    this.winnerDocked = false;
    this.cursorSettle = null;
    this.motionSettle = null;
    this.flight = null;
    this.burst = null;
    this.winnerLayer.visible = false;
    this.winnerLabel.text = "";
    this.winnerLabel.visible = false;
    this.winnerRing.visible = false;
    this.clearSparks();
    this.topBanner.text =
      payload.mode === "TARGET_GROUP"
        ? `${payload.targetGroupNo ?? "-"}조 대상 추첨`
        : "라운드로빈 추첨";
    this.rebuildPhysicsScene();
  }

  onPickResult(payload: PickResultPayload) {
    this.winnerId = payload.playerId;
    this.winnerName = payload.label;
    this.spinning = false;
    this.phaseLocked = false;
    this.winnerDocked = false;

    if (this.remaining.length === 0) return;

    const winnerIndex = this.candidateIndexById.get(payload.playerId);
    if (winnerIndex === undefined) return;

    let targetCursor =
      Math.floor(this.spinCursor / this.remaining.length) * this.remaining.length + winnerIndex;
    while (targetCursor < this.spinCursor + Math.max(this.remaining.length * 1.2, 4)) {
      targetCursor += this.remaining.length;
    }

    this.cursorSettle = {
      startTs: performance.now(),
      durationMs: clamp(Math.round(this.durationMs * 0.5), 1000, 2200),
      fromCursor: this.spinCursor,
      toCursor: targetCursor,
    };
    this.motionSettle = {
      startTs: performance.now(),
      durationMs: clamp(Math.round(this.durationMs * 0.5), 1000, 2200),
    };

    this.winnerToken.text = compactBallNumber(winnerIndex);
    this.winnerLabel.text = shortText(payload.label, 6);
    this.winnerLabel.visible = true;
    this.clearSparks();
  }

  onAssignConfirmed(payload: AssignConfirmedPayload) {
    this.spinning = false;
    this.phaseLocked = true;
    this.winnerId = payload.playerId;
    this.winnerName = payload.label;
    this.winnerLabel.text = shortText(payload.label, 6);
    this.winnerLabel.visible = true;
    this.topBanner.text = payload.groupNo ? `${payload.groupNo}조 배정 확정` : "배정 확정";
    this.cursorSettle = null;
    this.motionSettle = null;
    this.flight = null;
    this.stopAllMotion();
    this.clearSparks();
    if (!this.winnerLayer.visible && this.geometry) {
      this.winnerLayer.visible = true;
      this.winnerLayer.position.set(this.geometry.outletX, this.geometry.outletY);
      this.winnerLayer.scale.set(0.88);
      this.winnerDocked = true;
    }
  }

  private drawMachine(width: number, height: number) {
    clearChildren(this.bgLayer);
    clearChildren(this.machineLayer);
    this.dockFront.clear();

    const layoutWidth = clamp(width, 360, 760);
    const layoutHeight = clamp(height, 260, 430);
    const cx = width / 2;
    const topPad = 6;
    const bottomPad = 8;
    const neckHeight = 42;
    const dockHeight = 26;
    const dockOffset = 4;
    const winnerPad = 8;
    const radiusByWidth = clamp(layoutWidth * 0.27, 88, 160);
    const radiusByHeight = Math.floor(
      (layoutHeight - topPad - bottomPad - neckHeight - dockOffset - dockHeight - winnerPad) / 2
    );
    const radius = clamp(Math.min(radiusByWidth, radiusByHeight), 56, 160);
    const cy = topPad + radius;

    const panel = new Graphics()
      .roundRect(0, 0, width, height, 20)
      .fill({ color: 0xe4ebf7 })
      .stroke({ color: 0xbbcae1, width: 2 });
    const innerPanel = new Graphics()
      .roundRect(10, 10, width - 20, height - 20, 16)
      .fill({ color: 0xc9d6ea, alpha: 0.42 })
      .stroke({ color: 0xb4c5df, width: 1, alpha: 0.8 });
    this.bgLayer.addChild(panel, innerPanel);

    const topGlow = new Graphics()
      .ellipse(cx, 24, radius * 1.2, 12)
      .fill({ color: 0xffffff, alpha: 0.08 });
    this.bgLayer.addChild(topGlow);

    const baseShadow = new Graphics()
      .ellipse(cx, cy + radius + 28, radius * 0.64, 10)
      .fill({ color: 0x0f172a, alpha: 0.14 });
    this.bgLayer.addChild(baseShadow);

    const rearPlate = new Graphics()
      .ellipse(cx, cy + 2, radius * 0.86, radius * 0.86)
      .fill({ color: 0xf2f7ff, alpha: 0.9 });

    const frame = new Graphics()
      .circle(cx, cy, radius + 10)
      .fill({ color: 0xb9cadf })
      .stroke({ color: 0x8ba5c6, width: 3 });
    const frameInner = new Graphics()
      .circle(cx, cy, radius + 5)
      .stroke({ color: 0xd8e5f7, width: 2, alpha: 0.95 });
    const glass = new Graphics()
      .circle(cx, cy, radius)
      .fill({ color: 0xf7fbff, alpha: 0.97 })
      .stroke({ color: 0xcfe0f4, width: 2 })
      .ellipse(cx - radius * 0.28, cy - radius * 0.3, radius * 0.32, radius * 0.16)
      .fill({ color: 0xffffff, alpha: 0.35 });
    this.machineLayer.addChild(rearPlate, frame, frameInner, glass);

    this.chamberRotor
      .clear()
      .circle(0, 0, radius * 0.46)
      .stroke({ color: 0x9eb5d4, width: 2, alpha: 0.45 })
      .circle(0, 0, radius * 0.1)
      .fill({ color: 0xd9e6f8, alpha: 0.68 })
      .stroke({ color: 0x9eb5d4, width: 1.5, alpha: 0.65 });
    for (let i = 0; i < 4; i += 1) {
      const theta = (Math.PI * 2 * i) / 4;
      const ex = Math.cos(theta) * (radius * 0.42);
      const ey = Math.sin(theta) * (radius * 0.42);
      this.chamberRotor
        .moveTo(0, 0)
        .lineTo(ex, ey)
        .stroke({ color: 0x9bb3d1, width: 2, alpha: 0.35 });
    }
    this.chamberRotor.position.set(cx, cy);

    const rivets = new Graphics();
    const rivetCount = 10;
    for (let i = 0; i < rivetCount; i += 1) {
      const theta = (Math.PI * 2 * i) / rivetCount - Math.PI / 2;
      const rx = cx + Math.cos(theta) * (radius + 8);
      const ry = cy + Math.sin(theta) * (radius + 8);
      rivets
        .circle(rx, ry, 2.2)
        .fill({ color: 0xeaf2ff, alpha: 0.95 })
        .stroke({ color: 0x95abca, width: 1 });
    }
    this.machineLayer.addChild(rivets);

    const neckY = cy + radius;
    const neck = new Graphics()
      .roundRect(cx - 66, neckY, 132, neckHeight, 14)
      .fill({ color: 0xe5edf9 })
      .stroke({ color: 0xa8bdd8, width: 4 });
    const neckInset = new Graphics()
      .roundRect(cx - 58, neckY + 7, 116, neckHeight - 19, 10)
      .fill({ color: 0xd6e2f2, alpha: 0.82 });
    const outlet = new Graphics()
      .roundRect(cx - 28, neckY + neckHeight - 21, 56, 14, 7)
      .fill({ color: 0xf8fbff })
      .stroke({ color: 0xc0d2e8, width: 2 });
    const cupY = neckY + neckHeight + dockOffset;
    const dockBase = new Graphics()
      .roundRect(cx - 28, cupY - dockHeight / 2, 56, dockHeight, 13)
      .fill({ color: 0xeaf2ff })
      .stroke({ color: 0xa8bdd8, width: 3 });
    const dockInner = new Graphics()
      .ellipse(cx, cupY + 2, 14, 4.5)
      .fill({ color: 0xcfdcef, alpha: 0.9 });
    this.machineLayer.addChild(neck, neckInset, outlet, dockBase, dockInner);

    this.dockFront
      .roundRect(cx - 24, cupY - 3, 48, 11, 5.5)
      .fill({ color: 0xdde8f8, alpha: 0.92 })
      .stroke({ color: 0xa4bad9, width: 1.5, alpha: 0.9 });

    if (this.chamberMask) {
      this.actorLayer.removeChild(this.chamberMask);
      this.chamberMask.destroy();
      this.chamberMask = null;
    }
    this.chamberMask = new Graphics().circle(cx, cy, radius - 8).fill({ color: 0x000000 });
    this.actorLayer.addChild(this.chamberMask);
    this.chamber.mask = this.chamberMask;
    this.chamberRotor.mask = this.chamberMask;

    this.topBanner.position.set(cx, 20);
    this.geometry = {
      width,
      height,
      cx,
      cy,
      radius,
      outletX: cx,
      outletY: cupY - 10,
    };

    if (this.winnerDocked) {
      this.winnerLayer.position.set(cx, cupY - 8);
      this.winnerLayer.scale.set(0.88);
    }
  }

  private clearPhysics() {
    if (!this.engine) return;

    this.chamberWalls.forEach((wall) => Composite.remove(this.engine!.world, wall));
    this.chamberWalls = [];

    this.balls.forEach((ball) => Composite.remove(this.engine!.world, ball.body));
    this.balls = [];
    clearChildren(this.chamber);
  }

  private rebuildPhysicsScene() {
    if (!this.engine || !this.geometry) return;

    this.clearPhysics();
    this.buildChamberWalls();
    this.buildBallBodies();
  }

  private buildChamberWalls() {
    if (!this.engine || !this.geometry) return;

    const segments = 56;
    const thickness = 12;
    const wallRadius = this.geometry.radius - 7;
    const walls: Body[] = [];

    for (let i = 0; i < segments; i += 1) {
      const a1 = (Math.PI * 2 * i) / segments;
      const a2 = (Math.PI * 2 * (i + 1)) / segments;
      const x1 = this.geometry.cx + Math.cos(a1) * wallRadius;
      const y1 = this.geometry.cy + Math.sin(a1) * wallRadius;
      const x2 = this.geometry.cx + Math.cos(a2) * wallRadius;
      const y2 = this.geometry.cy + Math.sin(a2) * wallRadius;
      const mx = (x1 + x2) * 0.5;
      const my = (y1 + y2) * 0.5;
      const length = Math.hypot(x2 - x1, y2 - y1) + 2;
      const angle = Math.atan2(y2 - y1, x2 - x1);

      const wall = Bodies.rectangle(mx, my, length, thickness, {
        isStatic: true,
        angle,
        restitution: 0.95,
        friction: 0,
      });
      walls.push(wall);
    }

    this.chamberWalls = walls;
    World.add(this.engine.world, walls);
  }

  private buildBallBodies() {
    if (!this.engine || !this.geometry) return;
    if (this.remaining.length === 0) return;

    const count = this.remaining.length;
    const ballRadius = clamp(22 - count * 0.22, 10, 18);
    const maxOrbit = Math.max(20, this.geometry.radius * 0.56);

    const entities: BallEntity[] = [];

    for (let i = 0; i < count; i += 1) {
      const ring = Math.floor(i / 8) + 1;
      const theta = (Math.PI * 2 * i) / count;
      const dist = Math.min(ring * ballRadius * 2.05, maxOrbit);
      const x = this.geometry.cx + Math.cos(theta) * dist + randomInRange(-6, 6);
      const y = this.geometry.cy + Math.sin(theta) * dist + randomInRange(-6, 6);

      const body = Bodies.circle(x, y, ballRadius, {
        restitution: 0.88,
        friction: 0.005,
        frictionAir: 0.014,
        density: 0.0019,
      });
      World.add(this.engine.world, body);

      const container = new Container();
      const shadow = new Graphics()
        .ellipse(0, ballRadius * 0.78, ballRadius * 1.28, ballRadius * 0.44)
        .fill({ color: 0x0f172a, alpha: 0.2 });
      const baseTint = BALL_TINTS[i % BALL_TINTS.length];
      const bubble = new Graphics();
      drawBubble(bubble, baseTint, false);
      bubble.scale.set(ballRadius / 22);
      shadow.scale.set(ballRadius / 22);

      const token = new Text({
        text: compactBallNumber(i),
        style: new TextStyle({
          fontFamily: "Pretendard, SUIT, Noto Sans KR, sans-serif",
          fontSize: Math.round(ballRadius * 0.92),
          fontWeight: "900",
          fill: 0xffffff,
        }),
      });
      token.anchor.set(0.5, 0.62);

      const mini = new Text({
        text: shortText(this.remaining[i].label, 2),
        style: new TextStyle({
          fontFamily: "Pretendard, SUIT, Noto Sans KR, sans-serif",
          fontSize: Math.max(9, Math.round(ballRadius * 0.46)),
          fontWeight: "700",
          fill: 0xffffff,
        }),
      });
      mini.anchor.set(0.5, 0);
      mini.y = Math.round(ballRadius * 0.34);

      container.addChild(shadow, bubble, token, mini);
      container.position.set(x, y);
      this.chamber.addChild(container);

      entities.push({
        candidate: this.remaining[i],
        body,
        container,
        shadow,
        bubble,
        token,
        mini,
        baseTint,
        styleKey: "",
        hidden: false,
      });
    }

    this.balls = entities;
    this.syncBalls();
    this.app?.render();
  }

  private updateSpinCursor(now: number, deltaMs: number) {
    if (this.remaining.length === 0) {
      this.spinCursor = 0;
      return;
    }

    if (this.cursorSettle) {
      const t = clamp((now - this.cursorSettle.startTs) / this.cursorSettle.durationMs, 0, 1);
      const eased = easeOutCubic(t);
      this.spinCursor = lerp(this.cursorSettle.fromCursor, this.cursorSettle.toCursor, eased);
      if (t >= 1) {
        this.spinCursor = this.cursorSettle.toCursor;
        this.cursorSettle = null;
        this.motionSettle = null;
        this.startWinnerFlight(now);
      }
      return;
    }

    if (this.spinning) {
      const elapsed = Math.max(0, Date.now() - this.startAt);
      const progress = clamp(elapsed / Math.max(1, this.durationMs), 0, 1);
      const eased = easeOutCubic(progress);
      const speed = lerp(0.0105, 0.0022, eased);
      this.spinCursor += speed * deltaMs;
      return;
    }

    if (this.winnerId && !this.winnerDocked) {
      this.spinCursor += 0.0008 * deltaMs;
    }
  }

  private applyPhysicsForces(deltaMs: number) {
    if (!this.geometry || this.balls.length === 0) return;

    let swirl = 0;
    let jitter = 0;

    if (this.spinning) {
      const elapsed = Math.max(0, Date.now() - this.startAt);
      const progress = clamp(elapsed / Math.max(1, this.durationMs), 0, 1);
      const eased = easeOutCubic(progress);
      swirl = lerp(0.00011, 0.00002, eased);
      jitter = lerp(0.000013, 0.000004, eased);
    } else if (this.motionSettle) {
      const t = clamp(
        (performance.now() - this.motionSettle.startTs) / this.motionSettle.durationMs,
        0,
        1
      );
      swirl = lerp(0.00003, 0, easeOutCubic(t));
      jitter = lerp(0.000006, 0, t);
    }

    const targetOrbit = this.geometry.radius * 0.56;
    const winnerInFlight = this.flight && this.winnerId;

    this.balls.forEach((entity) => {
      if (entity.hidden) return;
      if (winnerInFlight && entity.candidate.id === this.winnerId) return;

      const dx = entity.body.position.x - this.geometry!.cx;
      const dy = entity.body.position.y - this.geometry!.cy;
      const dist = Math.max(1, Math.hypot(dx, dy));
      const nx = dx / dist;
      const ny = dy / dist;
      const tx = -ny;
      const ty = nx;

      if (swirl > 0 || jitter > 0) {
        const radialError = targetOrbit - dist;
        const inward = radialError * 0.0000016;
        Body.applyForce(entity.body, entity.body.position, {
          x: (tx * swirl + nx * inward + randomInRange(-jitter, jitter)) * deltaMs,
          y: (ty * swirl + ny * inward + randomInRange(-jitter, jitter)) * deltaMs,
        });
      } else {
        Body.setVelocity(entity.body, {
          x: entity.body.velocity.x * 0.985,
          y: entity.body.velocity.y * 0.985,
        });
      }

      const speed = Math.hypot(entity.body.velocity.x, entity.body.velocity.y);
      const maxSpeed = 10;
      if (speed > maxSpeed) {
        const ratio = maxSpeed / speed;
        Body.setVelocity(entity.body, {
          x: entity.body.velocity.x * ratio,
          y: entity.body.velocity.y * ratio,
        });
      }
    });
  }

  private applyBallStyle(entity: BallEntity, nextColor: number, winner = false) {
    const key = `${nextColor}:${winner ? 1 : 0}`;
    if (entity.styleKey === key) return;

    drawBubble(entity.bubble, nextColor, winner);
    const scale = entity.shadow.scale.x;
    entity.bubble.scale.set(scale);
    entity.token.style.fill = winner ? 0x0f172a : 0xffffff;
    entity.mini.style.fill = winner ? 0x1e293b : 0xffffff;
    entity.styleKey = key;
  }

  private syncBalls() {
    if (!this.geometry) return;

    const pointerIndex = wrapIndex(Math.round(this.spinCursor), this.remaining.length || 1);

    this.balls.forEach((entity) => {
      if (entity.hidden) {
        entity.container.visible = false;
        return;
      }

      entity.container.visible = true;
      entity.container.position.set(entity.body.position.x, entity.body.position.y);
      entity.container.rotation = entity.body.angle * 0.12;

      const depth = clamp(
        (entity.body.position.y - (this.geometry!.cy - this.geometry!.radius)) /
          (this.geometry!.radius * 2),
        0,
        1
      );
      entity.container.scale.set(lerp(0.84, 1.08, depth));
      entity.container.alpha = lerp(0.64, 1, depth);
      entity.container.zIndex = Math.round(depth * 1000);
      entity.shadow.alpha = lerp(0.14, 0.3, depth);

      const index = this.candidateIndexById.get(entity.candidate.id) ?? -1;
      const isPointer = index === pointerIndex && this.spinning;
      const isWinner =
        this.winnerId === entity.candidate.id && (this.cursorSettle !== null || this.winnerDocked);

      const tint = isWinner ? 0xfbbf24 : isPointer ? 0x38bdf8 : entity.baseTint;
      this.applyBallStyle(entity, tint, isWinner);
    });
  }

  private startWinnerFlight(now: number) {
    if (!this.geometry || !this.winnerId) return;
    const winnerEntity = this.balls.find((entity) => entity.candidate.id === this.winnerId);
    if (!winnerEntity) return;

    winnerEntity.hidden = true;
    winnerEntity.container.visible = false;
    Body.setStatic(winnerEntity.body, true);

    this.flight = {
      startTs: now,
      durationMs: 860,
      fromX: winnerEntity.body.position.x,
      fromY: winnerEntity.body.position.y,
      toX: this.geometry.outletX,
      toY: this.geometry.outletY,
    };
    this.burst = { startTs: now, durationMs: 620 };
    this.emitSparks(now, this.geometry.outletX, this.geometry.outletY);
    this.winnerLayer.visible = true;
    this.winnerLayer.position.set(this.flight.fromX, this.flight.fromY);
    this.winnerLabel.visible = true;
  }

  private syncWinner(now: number) {
    if (this.flight) {
      const t = clamp((now - this.flight.startTs) / this.flight.durationMs, 0, 1);
      const eased = easeInOutCubic(t);
      const arc = Math.sin(Math.PI * eased) * 52;
      this.winnerLayer.visible = true;
      this.winnerLayer.position.set(
        lerp(this.flight.fromX, this.flight.toX, eased),
        lerp(this.flight.fromY, this.flight.toY, eased) - arc
      );
      this.winnerLayer.scale.set(lerp(0.92, 1.06, Math.sin(Math.PI * eased)));

      if (t >= 1) {
        this.flight = null;
        this.winnerDocked = true;
        this.winnerLayer.position.set(this.geometry!.outletX, this.geometry!.outletY);
        this.winnerLayer.scale.set(0.88);
      }
    } else if (this.winnerDocked && this.geometry && this.winnerId) {
      this.winnerLayer.visible = true;
      this.winnerLayer.position.set(this.geometry.outletX, this.geometry.outletY);
      this.winnerLayer.scale.set(0.88);
    } else {
      this.winnerLayer.visible = false;
    }

    if (!this.burst) {
      this.winnerRing.visible = false;
      return;
    }

    const t = clamp((now - this.burst.startTs) / this.burst.durationMs, 0, 1);
    this.winnerRing.visible = true;
    this.winnerRing
      .clear()
      .circle(0, 0, lerp(30, 118, t))
      .stroke({ color: 0x22c55e, width: lerp(4, 1, t), alpha: lerp(0.62, 0, t) });
    this.winnerRing.position.copyFrom(this.winnerLayer.position);

    if (t >= 1) {
      this.winnerRing.visible = false;
      this.burst = null;
    }
  }

  private publishFrame(now: number) {
    if (!this.onFrame) return;
    if (now - this.publishTs < 66) return;
    this.publishTs = now;

    const progress =
      this.spinning && this.startAt > 0
        ? clamp((Date.now() - this.startAt) / Math.max(1, this.durationMs), 0, 1)
        : 1;

    const pointerIndex = wrapIndex(Math.round(this.spinCursor), this.remaining.length || 1);
    const centerLabel =
      this.remaining.length > 0 ? this.remaining[pointerIndex]?.label ?? null : null;

    this.onFrame({
      spinning: this.spinning || this.cursorSettle !== null || this.flight !== null,
      progress,
      spinPosition: this.spinCursor,
      centerLabel,
      winnerLabel: this.winnerName,
    });
  }

  private tick = () => {
    if (!this.app || !this.engine) return;
    const now = performance.now();
    const deltaMs = Math.min(33, this.app.ticker.deltaMS);

    const shouldAnimate =
      this.spinning || this.cursorSettle !== null || this.motionSettle !== null || this.flight !== null;

    if (shouldAnimate) {
      this.updateSpinCursor(now, deltaMs);
      this.applyPhysicsForces(deltaMs);
      Engine.update(this.engine, deltaMs);
      const targetRotor = this.spinning ? 0.022 : this.cursorSettle ? 0.009 : 0;
      this.rotorSpeed = lerp(this.rotorSpeed, targetRotor, 0.08);
    } else if (this.phaseLocked) {
      this.stopAllMotion();
      this.rotorSpeed = lerp(this.rotorSpeed, 0, 0.2);
    }
    this.chamberRotor.rotation += this.rotorSpeed * (deltaMs / 16.6);
    this.syncBalls();
    this.syncWinner(now);
    this.syncSparks(now);
    this.publishFrame(now);
    this.app.render();
  };

  private stopAllMotion() {
    this.balls.forEach((entity) => {
      Body.setVelocity(entity.body, { x: 0, y: 0 });
      Body.setAngularVelocity(entity.body, 0);
    });
  }

  private emitSparks(now: number, x: number, y: number) {
    this.clearSparks();
    const colors = [0x34d399, 0x60a5fa, 0xfacc15, 0x22d3ee];
    const items: SparkState[] = [];
    const count = 16;
    for (let i = 0; i < count; i += 1) {
      const angle = (Math.PI * 2 * i) / count + randomInRange(-0.15, 0.15);
      const speed = randomInRange(0.09, 0.16);
      const node = new Graphics()
        .circle(0, 0, randomInRange(2, 3.8))
        .fill({ color: colors[i % colors.length], alpha: 0.95 });
      node.position.set(x, y);
      this.fxLayer.addChild(node);
      items.push({
        node,
        startTs: now,
        durationMs: randomInRange(420, 680),
        fromX: x,
        fromY: y,
        vx: Math.cos(angle) * speed,
        vy: Math.sin(angle) * speed - randomInRange(0.01, 0.04),
      });
    }
    this.sparks = items;
  }

  private syncSparks(now: number) {
    if (this.sparks.length === 0) return;
    const alive: SparkState[] = [];
    for (const spark of this.sparks) {
      const t = clamp((now - spark.startTs) / spark.durationMs, 0, 1);
      const eased = easeOutCubic(t);
      spark.node.position.set(
        spark.fromX + spark.vx * eased * 360,
        spark.fromY + spark.vy * eased * 360 + eased * eased * 26
      );
      spark.node.alpha = 1 - t;
      spark.node.scale.set(lerp(1, 0.65, t));
      if (t < 1) {
        alive.push(spark);
      } else {
        spark.node.destroy();
      }
    }
    this.sparks = alive;
  }

  private clearSparks() {
    if (this.sparks.length === 0) return;
    this.sparks.forEach((spark) => spark.node.destroy());
    this.sparks = [];
  }
}

