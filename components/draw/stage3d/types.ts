import type {
  AnimatorCandidate,
  AnimatorPresentationMode,
  AnimatorProps,
} from "../../../lib/draw/animators/Animator";
import type { DrawPhase } from "../../../lib/draw/types";
import type { ScoreboardTempo } from "../../../lib/draw/animators/scoreboard/path";

export type StagePerformanceTier = "high" | "medium" | "low";

export type StagePhase =
  | "idle"
  | "configured"
  | "spinning"
  | "picked"
  | "assigning"
  | "finished";

export interface StageWinner {
  id: string;
  label: string;
}

export interface StagePhaseDirectives {
  stagePhase: StagePhase;
  statusText: string;
}

export interface StageBaseState {
  rawPhase: DrawPhase;
  stagePhase: StagePhase;
  statusText: string;
  performanceTier: StagePerformanceTier;
  presentationMode: AnimatorPresentationMode;
  mode: AnimatorProps["mode"];
  targetGroupNo: number | null;
  assignGroupNo: number | null;
  durationMs: number;
  startedAtMs: number;
  seed: number;
  tempo: ScoreboardTempo;
  currentStep: number;
  totalSteps: number;
  candidates: AnimatorCandidate[];
  winner: StageWinner | null;
  winnerIndex: number;
}

export interface StageTimelineState {
  nowMs: number;
  phaseElapsedMs: number;
  progress: number;
  elapsedMs: number;
  activeIndex: number | null;
  nearMissIndexes: number[];
  ringRotationY: number;
  winnerLift: number;
  assignTravel: number;
  isSettled: boolean;
}

export interface StageCandidateVisual extends AnimatorCandidate {
  index: number;
  isWinner: boolean;
  isActive: boolean;
  isNearMiss: boolean;
}

export interface StageHudState {
  title: string;
  subtitle: string;
  stepText: string;
  winnerName: string | null;
  activeName: string | null;
  statusText: string;
}

export interface StageSceneState {
  rawPhase: DrawPhase;
  phase: StagePhase;
  statusText: string;
  presentationMode: AnimatorPresentationMode;
  performanceTier: StagePerformanceTier;
  mode: AnimatorProps["mode"];
  progress: number;
  elapsedMs: number;
  activeIndex: number | null;
  nearMissIndexes: number[];
  ringRotationY: number;
  winnerLift: number;
  assignTravel: number;
  winner: StageWinner | null;
  targetGroupNo: number | null;
  assignGroupNo: number | null;
  currentStep: number;
  totalSteps: number;
  candidates: StageCandidateVisual[];
  hud: StageHudState;
}
