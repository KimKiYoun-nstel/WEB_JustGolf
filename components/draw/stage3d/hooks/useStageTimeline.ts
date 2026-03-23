"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import type { StageBaseState, StageTimelineState } from "../types";
import { computeTimelineProgress } from "../lib/computeTimelineProgress";

export function useStageTimeline(baseState: StageBaseState): StageTimelineState {
  const [nowMs, setNowMs] = useState(() => Date.now());
  const phaseTokenRef = useRef(`${baseState.currentStep}:${baseState.rawPhase}`);
  const phaseStartedAtRef = useRef(nowMs);

  useEffect(() => {
    const tickMs = baseState.performanceTier === "low" ? 80 : 40;
    const timer = window.setInterval(() => {
      setNowMs(Date.now());
    }, tickMs);
    return () => window.clearInterval(timer);
  }, [baseState.performanceTier]);

  useEffect(() => {
    const token = `${baseState.currentStep}:${baseState.rawPhase}`;
    if (phaseTokenRef.current === token) return;
    phaseTokenRef.current = token;
    phaseStartedAtRef.current = Date.now();
  }, [baseState.currentStep, baseState.rawPhase]);

  return useMemo(
    () =>
      computeTimelineProgress({
        baseState,
        nowMs,
        phaseElapsedMs: Math.max(0, nowMs - phaseStartedAtRef.current),
      }),
    [baseState, nowMs]
  );
}
