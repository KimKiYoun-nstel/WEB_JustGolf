import { Assets } from "pixi.js";

export const PIXI_ASSETS = {
  shadow: "/assets/shadow_soft.svg",
  ball: "/assets/ball.svg",
  ballWinner: "/assets/ball_winner.svg",
  glassOverlay: "/assets/glass_overlay.svg",
  rouletteFrame: "/assets/roulette_frame.svg",
} as const;

let preloadPromise: Promise<void> | null = null;

export function ensurePixiAssetsLoaded() {
  if (!preloadPromise) {
    preloadPromise = Assets.load([
      PIXI_ASSETS.shadow,
      PIXI_ASSETS.ball,
      PIXI_ASSETS.ballWinner,
      PIXI_ASSETS.glassOverlay,
      PIXI_ASSETS.rouletteFrame,
    ]).then(() => undefined);
  }
  return preloadPromise;
}

