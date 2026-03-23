import { resolveScoreboardCursorIndex } from "../../../../lib/draw/animators/scoreboard/path";
import type { StageBaseState, StageTimelineState } from "../types";

function clamp(value: number, min: number, max: number) {
  return Math.max(min, Math.min(max, value));
}

function wrapIndex(index: number, length: number) {
  if (length <= 0) return 0;
  return ((index % length) + length) % length;
}

function resolveNearMissIndexes(activeIndex: number, candidateCount: number, enabled: boolean) {
  if (!enabled || candidateCount <= 1) return [];
  if (candidateCount === 2) return [wrapIndex(activeIndex + 1, candidateCount)];
  return [
    wrapIndex(activeIndex - 1, candidateCount),
    wrapIndex(activeIndex + 1, candidateCount),
  ];
}

function resolveStaticRingRotation(seed: number, candidateCount: number) {
  if (candidateCount <= 0) return 0;
  return ((seed % candidateCount) / candidateCount) * Math.PI * 2;
}

export function computeTimelineProgress(params: {
  baseState: StageBaseState;
  nowMs: number;
  phaseElapsedMs: number;
}): StageTimelineState {
  const { baseState, nowMs, phaseElapsedMs } = params;
  const candidateCount = baseState.candidates.length;
  const elapsedMs = clamp(nowMs - baseState.startedAtMs, 0, baseState.durationMs);
  const progress = baseState.durationMs <= 0 ? 1 : clamp(elapsedMs / baseState.durationMs, 0, 1);
  const staticRotation = resolveStaticRingRotation(baseState.seed, candidateCount);

  if (candidateCount <= 0) {
    return {
      nowMs,
      phaseElapsedMs,
      progress: 0,
      elapsedMs: 0,
      activeIndex: null,
      nearMissIndexes: [],
      ringRotationY: staticRotation,
      winnerLift: 0,
      assignTravel: 0,
      isSettled: true,
    };
  }

  const activeIndexDuringSpin = resolveScoreboardCursorIndex({
    candidateCount,
    durationMs: baseState.durationMs,
    seed: baseState.seed,
    tempo: baseState.tempo,
    startedAtMs: baseState.startedAtMs,
    atMs: nowMs,
  });
  const nearMissIndexes = resolveNearMissIndexes(
    activeIndexDuringSpin,
    candidateCount,
    baseState.tempo.nearMiss > 0
  );

  if (baseState.stagePhase === "configured" || baseState.stagePhase === "spinning") {
    return {
      nowMs,
      phaseElapsedMs,
      progress,
      elapsedMs,
      activeIndex: activeIndexDuringSpin,
      nearMissIndexes,
      ringRotationY: staticRotation,
      winnerLift: 0,
      assignTravel: 0,
      isSettled: progress >= 1,
    };
  }

  if (baseState.stagePhase === "picked") {
    const pickedProgress = clamp(phaseElapsedMs / 650, 0, 1);
    const winnerIndex = baseState.winnerIndex >= 0 ? baseState.winnerIndex : activeIndexDuringSpin;
    return {
      nowMs,
      phaseElapsedMs,
      progress: 1,
      elapsedMs,
      activeIndex: winnerIndex,
      nearMissIndexes: resolveNearMissIndexes(winnerIndex, candidateCount, pickedProgress < 0.7),
      ringRotationY: staticRotation,
      winnerLift: pickedProgress,
      assignTravel: 0,
      isSettled: pickedProgress >= 1,
    };
  }

  if (baseState.stagePhase === "assigning") {
    const assignTravel = clamp(phaseElapsedMs / 950, 0, 1);
    return {
      nowMs,
      phaseElapsedMs,
      progress: 1,
      elapsedMs,
      activeIndex: baseState.winnerIndex >= 0 ? baseState.winnerIndex : null,
      nearMissIndexes: [],
      ringRotationY: staticRotation,
      winnerLift: 1,
      assignTravel,
      isSettled: assignTravel >= 1,
    };
  }

  return {
    nowMs,
    phaseElapsedMs,
    progress: 1,
    elapsedMs,
    activeIndex: baseState.winnerIndex >= 0 ? baseState.winnerIndex : null,
    nearMissIndexes: [],
    ringRotationY: staticRotation,
    winnerLift: 1,
    assignTravel: 1,
    isSettled: true,
  };
}
