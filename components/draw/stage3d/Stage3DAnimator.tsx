"use client";

import { useMemo } from "react";
import type { AnimatorProps } from "../../../lib/draw/animators/Animator";
import { usePerformanceTier } from "./hooks/usePerformanceTier";
import { mapAnimatorPropsToStageState } from "./lib/mapAnimatorPropsToStageState";
import { useStageTimeline } from "./hooks/useStageTimeline";
import { useStageSceneState } from "./hooks/useStageSceneState";
import { StageVaultScene } from "./StageVaultScene";
import { HudOverlay } from "./HudOverlay";

export function Stage3DAnimator(props: AnimatorProps) {
  const performanceTier = usePerformanceTier(Boolean(props.lowSpecMode));
  const baseState = useMemo(
    () => mapAnimatorPropsToStageState(props, performanceTier),
    [performanceTier, props]
  );
  const timeline = useStageTimeline(baseState);
  const sceneState = useStageSceneState(baseState, timeline);

  return (
    <div
      data-testid="draw-animator-root"
      className="flex flex-col gap-2 rounded-xl border border-slate-200 bg-white p-3 shadow-sm sm:p-4"
    >
      <div
        data-testid="draw-animator-stage-wrap"
        className="relative min-h-[460px] overflow-hidden rounded-2xl border border-slate-800 bg-[#04070f]"
      >
        <StageVaultScene sceneState={sceneState} />
        <HudOverlay sceneState={sceneState} />
      </div>
    </div>
  );
}
