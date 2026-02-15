import type { DrawMode, DrawPhase } from "../types";

export interface AnimatorProps {
  phase: DrawPhase;
  mode?: DrawMode | null;
  targetGroupNo?: number | null;
  assignGroupNo?: number | null;
  durationMs?: number | null;
  startedAt?: string | null;
  currentPickLabel?: string | null;
  candidateLabels?: string[];
  currentStep: number;
  totalSteps: number;
  lowSpecMode?: boolean;
}
