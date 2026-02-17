import { Application, Container } from "pixi.js";
import type { AnimatorQuality } from "./types";

function resolveAutoQuality(): Exclude<AnimatorQuality, "auto"> {
  if (typeof window === "undefined") return "high";
  const reducedMotion = window.matchMedia?.("(prefers-reduced-motion: reduce)")?.matches ?? false;
  const width = window.innerWidth;
  const memory = (navigator as Navigator & { deviceMemory?: number }).deviceMemory ?? 8;
  const cores = navigator.hardwareConcurrency ?? 8;
  if (reducedMotion) return "low";
  if (width < 900 || memory <= 4 || cores <= 4) return "low";
  return "high";
}

function pickResolution(quality: AnimatorQuality) {
  const resolvedQuality = quality === "auto" ? resolveAutoQuality() : quality;
  const dpr = typeof window === "undefined" ? 1 : window.devicePixelRatio || 1;
  if (resolvedQuality === "high") return Math.min(2, dpr);
  if (resolvedQuality === "low") return 1;
  return Math.min(2, dpr);
}

export class PixiBase {
  protected app: Application | null = null;
  protected mountPromise: Promise<void> | null = null;
  protected root = new Container();
  protected bgLayer = new Container();
  protected machineLayer = new Container();
  protected actorLayer = new Container();
  protected fxLayer = new Container();
  protected uiLayer = new Container();
  protected mountedElement: HTMLElement | null = null;
  protected currentQuality: AnimatorQuality = "auto";

  async mount(container: HTMLElement, quality: AnimatorQuality) {
    if (this.app) return;
    if (this.mountPromise) {
      await this.mountPromise;
      return;
    }
    this.currentQuality = quality;
    this.mountPromise = (async () => {
      const app = new Application();
      await app.init({
        resizeTo: container,
        preference: "webgl",
        antialias: true,
        backgroundAlpha: 0,
        resolution: pickResolution(quality),
        autoDensity: true,
        powerPreference: "high-performance",
      });

      container.appendChild(app.canvas);
      app.canvas.style.display = "block";
      app.canvas.style.width = "100%";
      app.canvas.style.height = "100%";
      app.stage.sortableChildren = true;
      this.root.sortableChildren = true;
      this.actorLayer.sortableChildren = true;
      this.fxLayer.sortableChildren = true;
      this.uiLayer.sortableChildren = true;
      this.bgLayer.zIndex = 0;
      this.machineLayer.zIndex = 10;
      this.actorLayer.zIndex = 20;
      this.fxLayer.zIndex = 30;
      this.uiLayer.zIndex = 40;
      this.root.addChild(this.bgLayer, this.machineLayer, this.actorLayer, this.fxLayer, this.uiLayer);
      this.root.sortChildren();
      app.stage.addChild(this.root);
      this.app = app;
      this.mountedElement = container;
      app.render();
      (app as Application & { start?: () => void }).start?.();
    })();

    try {
      await this.mountPromise;
    } catch (error) {
      this.mountPromise = null;
      throw error;
    }
  }

  resize(width: number, height: number) {
    if (!this.app) return;
    const safeWidth = Math.max(1, Math.floor(width));
    const safeHeight = Math.max(1, Math.floor(height));
    try {
      this.app.renderer.resize(safeWidth, safeHeight);
    } catch {
      // ignore renderer resize failures in transient mount states
    }
  }

  destroy() {
    if (!this.app) return;
    try {
      this.app.destroy(true);
    } catch {
      // ignore teardown errors
    }
    this.app = null;
    this.mountPromise = null;
    this.mountedElement = null;
    this.root.removeChildren();
    this.bgLayer.removeChildren();
    this.machineLayer.removeChildren();
    this.actorLayer.removeChildren();
    this.fxLayer.removeChildren();
    this.uiLayer.removeChildren();
  }
}
