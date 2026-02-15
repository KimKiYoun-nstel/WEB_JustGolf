import { Container, Graphics, Sprite, Text, TextStyle } from "pixi.js";
import { PixiBase } from "./PixiBase";
import { ensurePixiAssetsLoaded, PIXI_ASSETS } from "./assets";
import type {
  AnimatorQuality,
  AssignConfirmedPayload,
  CandidateItem,
  PickResultPayload,
  PixiAnimator,
  PixiFrameState,
  StepConfiguredPayload,
} from "./types";

type SettleState = {
  startTs: number;
  durationMs: number;
  fromRotation: number;
  toRotation: number;
};

type BurstState = {
  startTs: number;
  durationMs: number;
};

type RouletteOptions = {
  quality: AnimatorQuality;
  onFrame?: (frame: PixiFrameState) => void;
};

const TWO_PI = Math.PI * 2;
const SECTOR_COLORS = [0x1d4ed8, 0x06b6d4, 0xf59e0b, 0xef4444, 0x7c3aed, 0x0ea5e9];

function clamp(value: number, min: number, max: number) {
  return Math.max(min, Math.min(max, value));
}

function lerp(from: number, to: number, t: number) {
  return from + (to - from) * t;
}

function wrap(value: number, mod: number) {
  return ((value % mod) + mod) % mod;
}

function wrapIndex(index: number, length: number) {
  if (length <= 0) return 0;
  return ((index % length) + length) % length;
}

function easeOutCubic(t: number) {
  return 1 - (1 - t) ** 3;
}

function shortText(label: string, max = 8) {
  return Array.from(label.trim()).slice(0, max).join("");
}

function clearChildren(container: Container) {
  const removed = container.removeChildren();
  removed.forEach((child) => child.destroy({ children: true }));
}

export class PixiRouletteAnimator extends PixiBase implements PixiAnimator {
  private readonly quality: AnimatorQuality;
  private readonly onFrame?: (frame: PixiFrameState) => void;

  private readonly wheelRoot = new Container();
  private readonly wheelSectors = new Graphics();
  private readonly wheelLabels = new Container();
  private readonly pointer = new Graphics();
  private readonly winnerBurst = new Graphics();
  private readonly topBanner = new Text({
    text: "",
    style: new TextStyle({
      fontFamily: "Pretendard, SUIT, Noto Sans KR, sans-serif",
      fontSize: 16,
      fontWeight: "700",
      fill: 0x334155,
    }),
  });

  private centerX = 0;
  private centerY = 0;
  private radius = 150;
  private innerRadius = 52;

  private remaining: CandidateItem[] = [];
  private spinning = false;
  private startAt = 0;
  private durationMs = 3500;
  private rotation = 0;
  private settle: SettleState | null = null;
  private burst: BurstState | null = null;
  private winnerId: string | null = null;
  private winnerName: string | null = null;
  private publishTs = 0;

  constructor(options: RouletteOptions) {
    super();
    this.quality = options.quality;
    this.onFrame = options.onFrame;
  }

  async mount(container: HTMLElement) {
    await ensurePixiAssetsLoaded();
    await super.mount(container, this.quality);
    if (!this.app) return;

    this.machineLayer.addChild(this.wheelRoot);
    this.wheelRoot.addChild(this.wheelSectors, this.wheelLabels);
    this.fxLayer.addChild(this.pointer, this.winnerBurst);
    this.uiLayer.addChild(this.topBanner);
    this.topBanner.anchor.set(0.5);
    this.winnerBurst.visible = false;
    this.pointer.clear();

    this.app.ticker.add(this.tick);
    this.resize(container.clientWidth, container.clientHeight);
  }

  resize(width: number, height: number) {
    if (!this.app) return;
    super.resize(width, height);
    clearChildren(this.bgLayer);
    const removed = this.machineLayer.removeChildren();
    removed.forEach((child) => {
      if (child !== this.wheelRoot) {
        child.destroy({ children: true });
      }
    });
    if (!this.machineLayer.children.includes(this.wheelRoot)) {
      this.machineLayer.addChild(this.wheelRoot);
    }

    const layoutWidth = clamp(width, 360, 760);
    const layoutHeight = clamp(height, 280, 420);
    this.centerX = width / 2;
    this.centerY = Math.round(layoutHeight * 0.55);
    this.radius = clamp(Math.min(layoutWidth, layoutHeight) * 0.34, 112, 160);
    this.innerRadius = clamp(this.radius * 0.38, 46, 72);

    const panel = new Graphics()
      .roundRect(0, 0, width, height, 22)
      .fill({ color: 0xdee7f5 })
      .stroke({ color: 0xc7d5e7, width: 1 });
    this.bgLayer.addChild(panel);

    const shadow = Sprite.from(PIXI_ASSETS.shadow);
    shadow.anchor.set(0.5);
    shadow.position.set(this.centerX, this.centerY + this.radius + 24);
    shadow.width = this.radius * 2.25;
    shadow.height = 66;
    shadow.alpha = 0.55;
    this.bgLayer.addChild(shadow);

    const frameSprite = Sprite.from(PIXI_ASSETS.rouletteFrame);
    frameSprite.anchor.set(0.5);
    frameSprite.position.set(this.centerX, this.centerY);
    frameSprite.width = (this.radius + 14) * 2;
    frameSprite.height = (this.radius + 14) * 2;
    this.machineLayer.addChild(frameSprite, this.wheelRoot);

    this.wheelRoot.position.set(this.centerX, this.centerY);
    this.topBanner.position.set(this.centerX, 24);

    this.pointer
      .clear()
      .poly([this.centerX, 14, this.centerX - 16, 42, this.centerX + 16, 42])
      .fill({ color: 0xe11d48 })
      .stroke({ color: 0x9f1239, width: 1.5 });

    this.drawWheel();
  }

  destroy() {
    if (this.app) this.app.ticker.remove(this.tick);
    super.destroy();
  }

  onStepConfigured(payload: StepConfiguredPayload) {
    this.remaining = payload.remaining;
    this.spinning = payload.active ?? true;
    this.startAt = payload.startedAt;
    this.durationMs = clamp(payload.durationMs, 1000, 15000);
    this.winnerId = null;
    this.winnerName = null;
    this.settle = null;
    this.burst = null;
    this.winnerBurst.visible = false;
    this.topBanner.text =
      payload.mode === "TARGET_GROUP"
        ? `${payload.targetGroupNo ?? "-"}조 지정 추첨`
        : "라운드로빈 추첨";
    this.drawWheel();
  }

  onPickResult(payload: PickResultPayload) {
    this.winnerId = payload.playerId;
    this.winnerName = payload.label;
    this.spinning = false;

    const winnerIndex = this.remaining.findIndex((item) => item.id === payload.playerId);
    if (winnerIndex < 0 || this.remaining.length === 0) return;
    const sector = TWO_PI / this.remaining.length;
    const targetMod = -(winnerIndex * sector + sector / 2);
    let target = this.rotation;
    while (target < this.rotation + TWO_PI * 2.6) {
      target += TWO_PI;
    }
    target += targetMod - wrap(target, TWO_PI);

    this.settle = {
      startTs: performance.now(),
      durationMs: clamp(Math.round(this.durationMs * 0.58), 1200, 2300),
      fromRotation: this.rotation,
      toRotation: target,
    };
  }

  onAssignConfirmed(payload: AssignConfirmedPayload) {
    this.spinning = false;
    this.winnerId = payload.playerId;
    this.winnerName = payload.label;
    this.topBanner.text = payload.groupNo ? `${payload.groupNo}조 배정 확정` : "배정 확정";
  }

  private drawWheel() {
    const removed = this.wheelSectors.removeChildren();
    removed.forEach((child) => child.destroy({ children: true }));
    clearChildren(this.wheelLabels);
    this.wheelSectors.clear();

    const count = Math.max(1, this.remaining.length);
    const sector = TWO_PI / count;
    this.wheelSectors.circle(0, 0, this.radius).fill({ color: 0x1e293b, alpha: 0.05 });

    for (let i = 0; i < count; i += 1) {
      const start = -Math.PI / 2 + i * sector;
      const end = start + sector;
      const color = SECTOR_COLORS[i % SECTOR_COLORS.length];

      this.wheelSectors
        .moveTo(0, 0)
        .arc(0, 0, this.radius - 2, start, end)
        .lineTo(0, 0)
        .fill({ color })
        .stroke({ color: 0xffffff, width: 2 });

      const label = this.remaining[i]?.label ?? `후보${i + 1}`;
      const compact = shortText(label, 4);
      const angle = start + sector / 2;
      const x = Math.cos(angle) * (this.radius * 0.66);
      const y = Math.sin(angle) * (this.radius * 0.66);

      const text = new Text({
        text: compact,
        style: new TextStyle({
          fontFamily: "Pretendard, SUIT, Noto Sans KR, sans-serif",
          fontSize: count > 16 ? 11 : 13,
          fontWeight: "800",
          fill: 0xffffff,
          align: "center",
        }),
      });
      text.anchor.set(0.5);
      text.position.set(x, y);
      text.rotation = angle + Math.PI / 2;
      this.wheelLabels.addChild(text);
    }

    const center = new Graphics()
      .circle(0, 0, this.innerRadius)
      .fill({ color: 0xf8fafc })
      .stroke({ color: 0xcbd5e1, width: 3 });
    this.wheelSectors.addChild(center);
  }

  private publish(now: number) {
    if (!this.onFrame) return;
    if (now - this.publishTs < 66) return;
    this.publishTs = now;

    const count = Math.max(1, this.remaining.length);
    const sector = TWO_PI / count;
    const normalized = wrap(-this.rotation, TWO_PI);
    const index = wrapIndex(Math.floor(normalized / sector), count);
    const centerLabel = this.remaining[index]?.label ?? null;
    const progress =
      this.spinning && this.startAt > 0
        ? clamp((Date.now() - this.startAt) / Math.max(1, this.durationMs), 0, 1)
        : 1;

    this.onFrame({
      spinning: this.spinning,
      progress,
      spinPosition: index + normalized / sector - Math.floor(normalized / sector),
      centerLabel,
      winnerLabel: this.winnerName,
    });
  }

  private tick = () => {
    if (!this.app) return;
    const now = performance.now();

    if (this.settle) {
      const t = clamp((now - this.settle.startTs) / this.settle.durationMs, 0, 1);
      const eased = easeOutCubic(t);
      this.rotation = this.settle.fromRotation + (this.settle.toRotation - this.settle.fromRotation) * eased;
      if (t >= 1) {
        this.rotation = this.settle.toRotation;
        this.settle = null;
        this.burst = { startTs: now, durationMs: 580 };
      }
    } else if (this.spinning) {
      const elapsed = Math.max(0, Date.now() - this.startAt);
      const p = clamp(elapsed / Math.max(1, this.durationMs), 0, 1);
      const eased = easeOutCubic(p);
      const lowMode = this.quality === "low";
      const speed = lowMode ? lerp(0.0052, 0.0016, eased) : lerp(0.0105, 0.0024, eased);
      this.rotation += speed * this.app.ticker.deltaMS;
    }

    this.wheelRoot.rotation = this.rotation;
    this.syncBurst(now);
    this.publish(now);
    this.app.render();
  };

  private syncBurst(now: number) {
    if (!this.burst) {
      this.winnerBurst.visible = false;
      return;
    }
    const t = clamp((now - this.burst.startTs) / this.burst.durationMs, 0, 1);
    this.winnerBurst.visible = true;
    this.winnerBurst
      .clear()
      .circle(this.centerX, this.centerY, lerp(this.innerRadius, this.radius, t))
      .stroke({ color: 0xfbbf24, width: lerp(5, 1, t), alpha: lerp(0.55, 0, t) });
    if (t >= 1) {
      this.winnerBurst.visible = false;
      this.burst = null;
    }
  }
}
