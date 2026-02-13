import type { DrawPhase } from "../types";

export interface AnimatorProps {
  phase: DrawPhase;
  durationMs?: number | null;
  startedAt?: string | null;
  currentPickLabel?: string | null;
  candidateLabels?: string[];
  currentStep: number;
  totalSteps: number;
  lowSpecMode?: boolean;
}
