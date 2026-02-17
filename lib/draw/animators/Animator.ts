import type { DrawMode, DrawPhase } from "../types";

export type DrawAnimatorKind = "lotto" | "scoreboard";

export interface AnimatorCandidate {
  id: string;
  label: string;
  slotNo?: number;
}

export interface AnimatorStepTempo {
  baseHz?: number;
  slowdownMs?: number;
  nearMiss?: number;
}

export interface AnimatorProps {
  phase: DrawPhase;
  kind?: DrawAnimatorKind;
  mode?: DrawMode | null;
  targetGroupNo?: number | null;
  assignGroupNo?: number | null;
  durationMs?: number | null;
  startedAt?: string | null;
  currentPickCandidateId?: string | null;
  candidates?: AnimatorCandidate[];
  stepSeed?: number | null;
  stepPattern?: string | null;
  stepTempo?: AnimatorStepTempo | null;
  // Legacy fallback fields kept for compatibility during migration.
  currentPickLabel?: string | null;
  candidateLabels?: string[];
  currentStep: number;
  totalSteps: number;
  lowSpecMode?: boolean;
}
