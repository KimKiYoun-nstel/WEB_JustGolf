"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import type { CSSProperties } from "react";
import type { AnimatorProps } from "../../lib/draw/animators/Animator";
import PixiStage from "./PixiStage";
import { PixiLottoAnimator } from "../../lib/draw/animators/pixi/PixiLottoAnimator";
import { PixiRouletteAnimator } from "../../lib/draw/animators/pixi/PixiRouletteAnimator";
import type {
  AnimatorQuality,
  CandidateItem,
  PixiAnimator,
  PixiFrameState,
} from "../../lib/draw/animators/pixi/types";

type AnimatorVariant = "lotto" | "roulette";

const SLOT_VIEWPORT_HEIGHT = 196;
const SLOT_CARD_HEIGHT = 56;
const SLOT_CENTER_Y = (SLOT_VIEWPORT_HEIGHT - SLOT_CARD_HEIGHT) / 2;

function clamp(value: number, min: number, max: number) {
  return Math.max(min, Math.min(max, value));
}

function wrapIndex(index: number, length: number) {
  if (length <= 0) return 0;
  return ((index % length) + length) % length;
}

function normalizeLabel(label: string) {
  return label.trim();
}

function shortLabel(label: string, maxChars = 8) {
  return Array.from(normalizeLabel(label)).slice(0, maxChars).join("");
}

function resolveQuality(lowSpecMode: boolean): AnimatorQuality {
  if (lowSpecMode) return "low";
  if (typeof window === "undefined") return "auto";

  const reducedMotion =
    window.matchMedia?.("(prefers-reduced-motion: reduce)")?.matches ?? false;
  const width = window.innerWidth;
  const memory = (navigator as Navigator & { deviceMemory?: number }).deviceMemory ?? 8;
  const cores = navigator.hardwareConcurrency ?? 8;

  if (reducedMotion) return "low";
  if (width < 900 || memory <= 4 || cores <= 4) return "low";
  return "high";
}

function buildAnimator(
  variant: AnimatorVariant,
  quality: AnimatorQuality,
  onFrame: (next: PixiFrameState) => void
): PixiAnimator {
  if (variant === "roulette") return new PixiRouletteAnimator({ quality, onFrame });
  return new PixiLottoAnimator({ quality, onFrame });
}

export default function LottoAnimator({
  phase,
  mode,
  targetGroupNo,
  assignGroupNo,
  durationMs,
  startedAt,
  currentPickLabel,
  candidateLabels = [],
  currentStep,
  totalSteps,
  lowSpecMode = false,
}: AnimatorProps) {
  const variant: AnimatorVariant = "lotto";
  const quality = resolveQuality(lowSpecMode);
  const spinning = phase === "configured" || phase === "spinning";
  const pickedLabel = currentPickLabel ? normalizeLabel(currentPickLabel) : null;

  const candidates = useMemo(
    () => candidateLabels.map(normalizeLabel).filter((label) => label.length > 0),
    [candidateLabels]
  );

  const [frame, setFrame] = useState<PixiFrameState>({
    spinning: false,
    progress: 0,
    spinPosition: 0,
    centerLabel: null,
    winnerLabel: null,
  });

  const [pixiError, setPixiError] = useState<string | null>(null);

  const animator = useMemo(
    () => buildAnimator(variant, quality, setFrame),
    [variant, quality]
  );

  useEffect(() => {
    queueMicrotask(() => {
      setPixiError(null);
    });
  }, [animator]);

  const candidatesForStep = useMemo<CandidateItem[]>(
    () => candidates.map((label, idx) => ({ id: `${idx}:${label}`, label })),
    [candidates]
  );

  const stepTokenRef = useRef<string | null>(null);
  const pickTokenRef = useRef<string | null>(null);
  const assignTokenRef = useRef<string | null>(null);

  useEffect(() => {
    const token = [
      startedAt ?? "none",
      currentStep,
      mode ?? "ROUND_ROBIN",
      targetGroupNo ?? "null",
      quality,
      variant,
      durationMs ?? "default",
    ].join(":");
    if (stepTokenRef.current === token) return;
    stepTokenRef.current = token;
    pickTokenRef.current = null;
    assignTokenRef.current = null;

    animator.onStepConfigured({
      step: currentStep,
      mode: mode ?? "ROUND_ROBIN",
      targetGroupNo: targetGroupNo ?? null,
      startedAt: startedAt ? new Date(startedAt).getTime() : Date.now(),
      durationMs: clamp(durationMs ?? 3500, 1000, 15000),
      remaining: candidatesForStep,
      quality,
      active: spinning,
    });
  }, [
    animator,
    startedAt,
    currentStep,
    candidatesForStep,
    mode,
    targetGroupNo,
    durationMs,
    quality,
    variant,
    spinning,
  ]);

  useEffect(() => {
    if (phase !== "picked" || !pickedLabel) return;
    const token = `${currentStep}:${pickedLabel}:${candidatesForStep.length}`;
    if (pickTokenRef.current === token) return;
    pickTokenRef.current = token;

    const winner = candidatesForStep.find((item) => item.label === pickedLabel) ?? {
      id: `winner:${pickedLabel}`,
      label: pickedLabel,
    };

    animator.onPickResult({
      step: currentStep,
      playerId: winner.id,
      label: winner.label,
    });
  }, [animator, phase, pickedLabel, currentStep, candidatesForStep]);

  useEffect(() => {
    if ((phase !== "confirmed" && phase !== "finished") || !pickedLabel) return;
    const resolvedGroupNo = assignGroupNo ?? targetGroupNo ?? null;
    const token = `${phase}:${currentStep}:${pickedLabel}:${resolvedGroupNo ?? "null"}`;
    if (assignTokenRef.current === token) return;
    assignTokenRef.current = token;

    const winner = candidatesForStep.find((item) => item.label === pickedLabel) ?? {
      id: `winner:${pickedLabel}`,
      label: pickedLabel,
    };

    animator.onAssignConfirmed({
      step: currentStep,
      playerId: winner.id,
      label: winner.label,
      groupNo: resolvedGroupNo,
    });
  }, [
    animator,
    phase,
    pickedLabel,
    currentStep,
    assignGroupNo,
    targetGroupNo,
    candidatesForStep,
  ]);

  const candidateCount = candidates.length;
  const spinPosition = frame.spinPosition;
  const baseIndex = Math.floor(spinPosition);
  const fraction = spinPosition - baseIndex;

  const centerLabel =
    frame.centerLabel ??
    (candidateCount > 0 ? candidates[wrapIndex(baseIndex, candidateCount)] : null);
  const displayWinnerLabel = frame.winnerLabel ?? pickedLabel;
  const progress = spinning ? frame.progress : 0;

  const slotRows = useMemo(() => {
    if (candidateCount === 0) {
      return [{ key: "empty", label: "-", y: SLOT_CENTER_Y }];
    }
    return Array.from({ length: 7 }, (_, row) => {
      const offset = row - 3;
      const label = candidates[wrapIndex(baseIndex + offset, candidateCount)];
      const y = SLOT_CENTER_Y + (offset - fraction) * SLOT_CARD_HEIGHT;
      return { key: `${row}-${baseIndex}-${label}`, label, y };
    });
  }, [candidateCount, candidates, baseIndex, fraction]);

  const slotTrackStyle: CSSProperties = {
    height: `${SLOT_VIEWPORT_HEIGHT}px`,
  };

  const handlePixiError = useCallback((error: unknown) => {
    console.error("[draw] pixi stage failed", error);
    const message = error instanceof Error ? error.message : String(error);
    setPixiError(message || "Pixi stage failed");
  }, []);

  return (
    <div
      data-testid="draw-animator-root"
      className="flex flex-col items-center gap-4 rounded-xl border border-slate-200 bg-white p-6 shadow-sm"
    >
      <div className="text-sm text-slate-500">
        Step {Math.min(currentStep + 1, totalSteps)} / {totalSteps}
      </div>

      <div
        data-testid="draw-animator-stage-wrap"
        className="relative w-full max-w-[760px] overflow-hidden rounded-2xl border border-slate-200 bg-[linear-gradient(180deg,#f3f7ff_0%,#e9effa_100%)] px-4 py-5"
      >
        <PixiStage
          animator={animator}
          className="relative mx-auto h-[390px] w-full max-w-[560px]"
          onError={handlePixiError}
        />
        {pixiError ? (
          <div className="pointer-events-none absolute inset-x-4 bottom-4 rounded-lg border border-rose-200 bg-rose-50/90 px-3 py-2 text-xs text-rose-700">
            Pixi 렌더 오류: {pixiError}
          </div>
        ) : null}
      </div>

      <div className="w-full max-w-md space-y-2 text-center">
        <p className="text-xs text-slate-500">
          남은 후보 {candidateCount}명
          {spinning ? ` · 연출 ${(progress * 100).toFixed(0)}%` : ""}
        </p>

        <div className="rounded-lg border border-slate-200 bg-slate-50 px-4 py-3">
          <p className="text-xs text-slate-500">현재 추첨 라인업</p>
          <div className="mx-auto mt-2 w-full max-w-[410px] overflow-hidden rounded-xl border border-slate-300 bg-gradient-to-b from-slate-100 to-white p-2 shadow-[inset_0_2px_3px_rgba(15,23,42,0.12)]">
            <div className="relative overflow-hidden rounded-lg bg-white/95" style={slotTrackStyle}>
              <div className="pointer-events-none absolute inset-x-0 top-0 z-10 h-8 bg-gradient-to-b from-white to-transparent" />
              <div className="pointer-events-none absolute inset-x-0 bottom-0 z-10 h-8 bg-gradient-to-t from-white to-transparent" />
              {slotRows.map((row) => {
                const distance = Math.abs(row.y - SLOT_CENTER_Y);
                const highlighted = distance < SLOT_CARD_HEIGHT * 0.42;
                return (
                  <div
                    key={row.key}
                    className={`absolute left-2 right-2 flex h-[56px] items-center justify-center rounded-lg border px-2 text-center shadow-sm ${
                      highlighted
                        ? "border-emerald-300 bg-emerald-50 text-emerald-800"
                        : "border-slate-200 bg-white text-slate-700"
                    }`}
                    style={{
                      transform: `translateY(${row.y}px)`,
                      opacity: clamp(1 - distance / 130, 0.2, 1),
                    }}
                  >
                    <span
                      className="truncate text-[31px] font-black leading-none tracking-[-0.03em]"
                      style={{
                        fontFamily:
                          "'Pretendard Variable', 'Pretendard', 'SUIT Variable', 'Noto Sans KR', 'Malgun Gothic', sans-serif",
                      }}
                    >
                      {shortLabel(row.label, 8)}
                    </span>
                  </div>
                );
              })}
            </div>
          </div>
        </div>

        <p className="text-xs text-slate-500">바구니 중심 후보: {centerLabel ?? "-"}</p>

        {spinning && (
          <div className="h-2 overflow-hidden rounded-full bg-slate-200">
            <div
              className="h-full rounded-full bg-sky-500 transition-[width] duration-150"
              style={{ width: `${Math.max(4, progress * 100)}%` }}
            />
          </div>
        )}

        {spinning ? (
          <p className="text-sm font-medium text-sky-700">로또 추첨 중...</p>
        ) : displayWinnerLabel ? (
          <p className="text-sm font-semibold text-emerald-700">당첨: {displayWinnerLabel}</p>
        ) : (
          <p className="text-sm text-slate-500">다음 스텝을 준비하세요.</p>
        )}
      </div>
    </div>
  );
}
