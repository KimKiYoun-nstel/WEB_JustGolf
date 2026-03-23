import type { DrawPhase } from "../../../../lib/draw/types";
import type { StagePhaseDirectives } from "../types";

export function mapDrawPhaseToStagePhase(phase: DrawPhase): StagePhaseDirectives {
  switch (phase) {
    case "configured":
      return { stagePhase: "configured", statusText: "추첨 준비 중" };
    case "spinning":
      return { stagePhase: "spinning", statusText: "라이브 스캔 진행 중" };
    case "picked":
      return { stagePhase: "picked", statusText: "당첨 후보 확정 중" };
    case "confirmed":
      return { stagePhase: "assigning", statusText: "조 배정 반영 중" };
    case "finished":
      return { stagePhase: "finished", statusText: "라운드 완료" };
    case "idle":
    default:
      return { stagePhase: "idle", statusText: "대기 중" };
  }
}

