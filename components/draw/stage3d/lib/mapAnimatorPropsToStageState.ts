import type { AnimatorCandidate, AnimatorProps } from "../../../../lib/draw/animators/Animator";
import {
  deriveDrawSeed,
  normalizeScoreboardTempo,
} from "../../../../lib/draw/animators/scoreboard/path";
import type { StageBaseState, StagePerformanceTier, StageWinner } from "../types";
import { mapDrawPhaseToStagePhase } from "./computePhaseDirectives";

function normalizeCandidateList(props: AnimatorProps): AnimatorCandidate[] {
  if (Array.isArray(props.candidates) && props.candidates.length > 0) {
    return props.candidates
      .map((candidate, index) => ({
        id: String(candidate.id ?? index),
        label: String(candidate.label ?? "").trim(),
        slotNo: candidate.slotNo ?? index + 1,
      }))
      .filter((candidate) => candidate.label.length > 0);
  }

  if (Array.isArray(props.candidateLabels) && props.candidateLabels.length > 0) {
    return props.candidateLabels
      .map((label, index) => ({
        id: String(index),
        label: String(label ?? "").trim(),
        slotNo: index + 1,
      }))
      .filter((candidate) => candidate.label.length > 0);
  }

  return [];
}

function resolveWinner(candidates: AnimatorCandidate[], props: AnimatorProps): StageWinner | null {
  const pickedId = props.currentPickCandidateId ? String(props.currentPickCandidateId) : null;
  if (pickedId) {
    const found = candidates.find((candidate) => candidate.id === pickedId);
    if (found) return { id: found.id, label: found.label };
  }

  const pickedLabel = String(props.currentPickLabel ?? "").trim();
  if (pickedLabel.length > 0) {
    const foundByLabel = candidates.find((candidate) => candidate.label === pickedLabel);
    if (foundByLabel) return { id: foundByLabel.id, label: foundByLabel.label };
    return { id: pickedId ?? `winner:${pickedLabel}`, label: pickedLabel };
  }

  return null;
}

function resolveStartedAtMs(startedAt?: string | null) {
  if (!startedAt) return Date.now();
  const parsed = new Date(startedAt).getTime();
  return Number.isFinite(parsed) ? parsed : Date.now();
}

export function mapAnimatorPropsToStageState(
  props: AnimatorProps,
  performanceTier: StagePerformanceTier
): StageBaseState {
  const directives = mapDrawPhaseToStagePhase(props.phase);
  const candidates = normalizeCandidateList(props);
  const winner = resolveWinner(candidates, props);
  const winnerIndex = winner
    ? candidates.findIndex((candidate) => candidate.id === winner.id)
    : -1;
  const durationMs = Math.min(30_000, Math.max(800, props.durationMs ?? 6500));
  const startedAtMs = resolveStartedAtMs(props.startedAt);
  const seed =
    typeof props.stepSeed === "number" && Number.isFinite(props.stepSeed)
      ? Math.trunc(props.stepSeed)
      : deriveDrawSeed([
          "stage3d-v1",
          props.currentStep,
          props.startedAt ?? "none",
          durationMs,
          candidates.map((candidate) => candidate.id).join(","),
        ]);

  return {
    rawPhase: props.phase,
    stagePhase: directives.stagePhase,
    statusText: directives.statusText,
    performanceTier,
    presentationMode: props.presentationMode ?? "viewer",
    mode: props.mode ?? null,
    targetGroupNo: props.targetGroupNo ?? null,
    assignGroupNo: props.assignGroupNo ?? null,
    durationMs,
    startedAtMs,
    seed,
    tempo: normalizeScoreboardTempo(props.stepTempo),
    currentStep: props.currentStep,
    totalSteps: props.totalSteps,
    candidates,
    winner,
    winnerIndex,
  };
}

