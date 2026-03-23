import { useMemo } from "react";
import type { StageBaseState, StageSceneState, StageTimelineState } from "../types";

function resolveTitle(phase: StageSceneState["phase"]) {
  switch (phase) {
    case "configured":
      return "라운드 준비";
    case "spinning":
      return "후보 스캔 진행";
    case "picked":
      return "후보 잠금 완료";
    case "assigning":
      return "조 배정 이동";
    case "finished":
      return "배정 완료";
    case "idle":
    default:
      return "대기 상태";
  }
}

function resolveSubtitle(baseState: StageBaseState) {
  if (baseState.stagePhase === "spinning") {
    return "후보 스캔 월에서 전체 후보를 훑으며 당첨 후보를 좁혀갑니다.";
  }
  if (baseState.stagePhase === "picked") {
    return "선택된 후보를 중앙에 고정하고 최종 당첨을 확정합니다.";
  }
  if (baseState.stagePhase === "assigning") {
    return `${baseState.assignGroupNo ?? baseState.targetGroupNo ?? "-"}조 슬롯으로 이동해 배정을 마무리합니다.`;
  }
  if (baseState.stagePhase === "finished") {
    return `${baseState.assignGroupNo ?? baseState.targetGroupNo ?? "-"}조 배정이 완료되었습니다.`;
  }
  if (baseState.mode === "TARGET_GROUP") {
    return `${baseState.targetGroupNo ?? "-"}조 지정 추첨 준비`;
  }
  return "라운드 로빈 추첨 준비";
}

export function useStageSceneState(
  baseState: StageBaseState,
  timeline: StageTimelineState
): StageSceneState {
  return useMemo(() => {
    const candidates = baseState.candidates.map((candidate, index) => ({
      ...candidate,
      index,
      isWinner: Boolean(baseState.winner && candidate.id === baseState.winner.id),
      isActive: timeline.activeIndex === index,
      isNearMiss: timeline.nearMissIndexes.includes(index),
    }));

    const stepIndex = Math.min(baseState.currentStep + 1, baseState.totalSteps);
    const winnerName = baseState.winner ? baseState.winner.label : null;
    const activeName =
      typeof timeline.activeIndex === "number"
        ? baseState.candidates[timeline.activeIndex]?.label ?? null
        : null;

    return {
      rawPhase: baseState.rawPhase,
      phase: baseState.stagePhase,
      statusText: baseState.statusText,
      presentationMode: baseState.presentationMode,
      performanceTier: baseState.performanceTier,
      mode: baseState.mode,
      progress: timeline.progress,
      elapsedMs: timeline.elapsedMs,
      activeIndex: timeline.activeIndex,
      nearMissIndexes: timeline.nearMissIndexes,
      ringRotationY: timeline.ringRotationY,
      winnerLift: timeline.winnerLift,
      assignTravel: timeline.assignTravel,
      winner: baseState.winner,
      targetGroupNo: baseState.targetGroupNo,
      assignGroupNo: baseState.assignGroupNo,
      currentStep: baseState.currentStep,
      totalSteps: baseState.totalSteps,
      candidates,
      hud: {
        title: resolveTitle(baseState.stagePhase),
        subtitle: resolveSubtitle(baseState),
        stepText: `Step ${stepIndex} / ${baseState.totalSteps}`,
        winnerName,
        activeName,
        statusText: baseState.statusText,
      },
    };
  }, [baseState, timeline]);
}
