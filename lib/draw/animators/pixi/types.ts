export type AnimatorQuality = "auto" | "high" | "low";

export type StepMode = "ROUND_ROBIN" | "TARGET_GROUP";

export type CandidateItem = {
  id: string;
  label: string;
};

export type StepConfiguredPayload = {
  step: number;
  mode: StepMode;
  targetGroupNo: number | null;
  startedAt: number;
  durationMs: number;
  remaining: CandidateItem[];
  quality: AnimatorQuality;
  active?: boolean;
};

export type PickResultPayload = {
  step: number;
  playerId: string;
  label: string;
};

export type AssignConfirmedPayload = {
  step: number;
  playerId: string;
  label: string;
  groupNo: number | null;
};

export type PixiFrameState = {
  spinning: boolean;
  progress: number;
  spinPosition: number;
  centerLabel: string | null;
  winnerLabel: string | null;
};

export interface PixiAnimator {
  mount(container: HTMLElement): Promise<void>;
  resize(width: number, height: number): void;
  destroy(): void;
  onStepConfigured(payload: StepConfiguredPayload): void;
  onPickResult(payload: PickResultPayload): void;
  onAssignConfirmed(payload: AssignConfirmedPayload): void;
}
