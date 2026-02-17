"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import type { AnimatorCandidate, AnimatorProps } from "../../../lib/draw/animators/Animator";
import {
  buildScoreboardRevealPath,
  buildScoreboardScanPath,
  deriveDrawSeed,
  normalizeScoreboardTempo,
  resolveScoreboardScanIndexAtElapsed,
} from "../../../lib/draw/animators/scoreboard/path";
import CandidateGrid from "./CandidateGrid";
import LowerThird from "./LowerThird";

const EMPTY_LABELS: string[] = [];

interface MotionState {
  activeIndex: number | null;
  trailIndices: number[];
  progress: number;
  spinning: boolean;
  revealSettled: boolean;
}

interface MotionUpdateOptions {
  revealSettled?: boolean;
  resetTrail?: boolean;
}

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

function toFiniteNumber(value: unknown, fallback: number) {
  if (typeof value !== "number" || !Number.isFinite(value)) return fallback;
  return value;
}

function resolveStartedAtMs(startedAt?: string | null) {
  if (!startedAt) return Date.now();
  const ms = new Date(startedAt).getTime();
  return Number.isFinite(ms) ? ms : Date.now();
}

function resolveCurrentPickedCandidate(
  candidates: AnimatorCandidate[],
  pickedCandidateId?: string | null,
  pickedLabel?: string | null
) {
  const normalizedPickedId = pickedCandidateId ? String(pickedCandidateId) : null;
  if (normalizedPickedId) {
    const found = candidates.find((candidate) => candidate.id === normalizedPickedId);
    if (found) return found;
  }

  const normalizedPickedLabel = pickedLabel ? normalizeLabel(pickedLabel) : "";
  if (normalizedPickedLabel) {
    const foundByLabel = candidates.find(
      (candidate) => normalizeLabel(candidate.label) === normalizedPickedLabel
    );
    if (foundByLabel) return foundByLabel;
    return {
      id: normalizedPickedId ?? `picked:${normalizedPickedLabel}`,
      label: normalizedPickedLabel,
    };
  }

  return null;
}

function truncateLabel(value: string, maxChars: number) {
  return Array.from(value.trim()).slice(0, maxChars).join("");
}

export default function ScoreboardAnimator({
  phase,
  mode,
  targetGroupNo,
  durationMs,
  startedAt,
  currentPickCandidateId,
  currentPickLabel,
  candidates: candidateItems,
  candidateLabels,
  currentStep,
  totalSteps,
  lowSpecMode = false,
  stepSeed,
  stepPattern,
  stepTempo,
}: AnimatorProps) {
  const normalizedCandidates = useMemo<AnimatorCandidate[]>(() => {
    if (candidateItems && candidateItems.length > 0) {
      const out: AnimatorCandidate[] = [];
      candidateItems.forEach((candidate, index) => {
        const label = normalizeLabel(candidate.label ?? "");
        if (!label) return;
        out.push({
          id: String(candidate.id ?? index),
          label,
          slotNo: candidate.slotNo ?? index + 1,
        });
      });
      return out;
    }

    const labels = candidateLabels ?? EMPTY_LABELS;
    return labels
      .map((label) => normalizeLabel(label))
      .filter((label) => label.length > 0)
      .map((label, index) => ({
        id: String(index),
        label,
        slotNo: index + 1,
      }));
  }, [candidateItems, candidateLabels]);

  const candidateCount = normalizedCandidates.length;
  const [motion, setMotion] = useState<MotionState>(() => ({
    activeIndex: candidateCount > 0 ? 0 : null,
    trailIndices: [],
    progress: 0,
    spinning: false,
    revealSettled: false,
  }));

  const motionRef = useRef<MotionState>(motion);
  const scanTimerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const revealTimerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const shuffleTimerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const shuffleStopRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const mobileFlipTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const revealTokenRef = useRef<string | null>(null);
  const prevOrderSignatureRef = useRef<string | null>(null);
  const prevOrderCountRef = useRef<number>(candidateCount);
  const [mobileShowFront, setMobileShowFront] = useState(false);

  const currentPickedCandidate = useMemo(
    () =>
      resolveCurrentPickedCandidate(
        normalizedCandidates,
        currentPickCandidateId,
        currentPickLabel
      ),
    [normalizedCandidates, currentPickCandidateId, currentPickLabel]
  );

  const modeText = mode === "TARGET_GROUP" ? "TARGET_GROUP" : "ROUND_ROBIN";
  const spinning = phase === "configured" || phase === "spinning";
  const safeDurationMs = Math.round(clamp(toFiniteNumber(durationMs, 6500), 1000, 20000));
  const normalizedTempo = useMemo(() => normalizeScoreboardTempo(stepTempo), [stepTempo]);
  const effectiveTempo = useMemo(() => {
    if (!lowSpecMode) return normalizedTempo;
    return {
      ...normalizedTempo,
      baseHz: Math.min(normalizedTempo.baseHz, 12),
      slowdownMs: Math.min(normalizedTempo.slowdownMs, 1800),
      nearMiss: Math.min(normalizedTempo.nearMiss, 1),
    };
  }, [lowSpecMode, normalizedTempo]);

  const seed = useMemo(() => {
    const explicit = toFiniteNumber(stepSeed, -1);
    if (explicit >= 0) return Math.trunc(explicit);
    return deriveDrawSeed([
      "scoreboard-v1",
      currentStep,
      startedAt ?? "none",
      safeDurationMs,
      normalizedCandidates.map((candidate) => candidate.id).join(","),
    ]);
  }, [currentStep, startedAt, safeDurationMs, normalizedCandidates, stepSeed]);

  const orderSignature = useMemo(
    () => normalizedCandidates.map((candidate) => candidate.id).join(","),
    [normalizedCandidates]
  );

  const updateMotion = useCallback(
    (
      nextIndex: number | null,
      progress: number,
      isSpinning: boolean,
      options?: MotionUpdateOptions
    ) => {
      setMotion((prev) => {
        const normalizedIndex =
          nextIndex === null || candidateCount <= 0 ? null : wrapIndex(nextIndex, candidateCount);
        const trail = options?.resetTrail
          ? []
          : normalizedIndex === null ||
              prev.activeIndex === null ||
              prev.activeIndex === normalizedIndex
            ? prev.trailIndices
            : [prev.activeIndex, ...prev.trailIndices.filter((index) => index !== prev.activeIndex)]
                .slice(0, 4);

        const next: MotionState = {
          activeIndex: normalizedIndex,
          trailIndices: trail,
          progress: clamp(progress, 0, 1),
          spinning: isSpinning,
          revealSettled:
            typeof options?.revealSettled === "boolean"
              ? options.revealSettled
              : prev.revealSettled,
        };
        motionRef.current = next;
        return next;
      });
    },
    [candidateCount]
  );

  const clearShuffleFx = useCallback(() => {
    if (shuffleTimerRef.current) {
      clearInterval(shuffleTimerRef.current);
      shuffleTimerRef.current = null;
    }
    if (shuffleStopRef.current) {
      clearTimeout(shuffleStopRef.current);
      shuffleStopRef.current = null;
    }
  }, []);

  const runDeckShuffleFx = useCallback(() => {
    if (candidateCount <= 1) return;
    clearShuffleFx();

    const fixedProgress = motionRef.current.progress;
    let pointer = motionRef.current.activeIndex ?? wrapIndex(seed, candidateCount);
    let hop = 0;
    const hopPattern = [1, 2, 1, 3];

    updateMotion(pointer, fixedProgress, true, {
      revealSettled: false,
      resetTrail: true,
    });

    shuffleTimerRef.current = setInterval(() => {
      pointer = wrapIndex(pointer + hopPattern[hop % hopPattern.length], candidateCount);
      hop += 1;
      updateMotion(pointer, fixedProgress, true, { revealSettled: false });
    }, lowSpecMode ? 90 : 70);

    shuffleStopRef.current = setTimeout(() => {
      clearShuffleFx();
      const finalIndex = wrapIndex(seed % candidateCount, candidateCount);
      updateMotion(finalIndex, fixedProgress, false, {
        revealSettled: true,
        resetTrail: true,
      });
    }, lowSpecMode ? 760 : 920);
  }, [candidateCount, clearShuffleFx, lowSpecMode, seed, updateMotion]);

  useEffect(() => {
    return () => {
      if (scanTimerRef.current) clearInterval(scanTimerRef.current);
      if (revealTimerRef.current) clearInterval(revealTimerRef.current);
      if (mobileFlipTimerRef.current) clearTimeout(mobileFlipTimerRef.current);
      clearShuffleFx();
    };
  }, [clearShuffleFx]);

  useEffect(() => {
    revealTokenRef.current = null;
    updateMotion(motionRef.current.activeIndex ?? 0, motionRef.current.progress, false, {
      revealSettled: false,
      resetTrail: true,
    });
  }, [currentStep, updateMotion]);

  useEffect(() => {
    const previousSignature = prevOrderSignatureRef.current;
    const previousCount = prevOrderCountRef.current;
    prevOrderSignatureRef.current = orderSignature;
    prevOrderCountRef.current = candidateCount;

    if (previousSignature === null) return;
    if (previousSignature === orderSignature) return;
    if (previousCount !== candidateCount || candidateCount <= 1) return;
    if (spinning || phase === "picked") return;

    runDeckShuffleFx();
  }, [candidateCount, orderSignature, phase, runDeckShuffleFx, spinning]);

  useEffect(() => {
    if (candidateCount <= 0) {
      updateMotion(null, 0, false, { revealSettled: true, resetTrail: true });
      return;
    }

    if (!spinning) {
      if (scanTimerRef.current) {
        clearInterval(scanTimerRef.current);
        scanTimerRef.current = null;
      }
      if (shuffleTimerRef.current) return;

      const revealSettled = phase === "idle" ? true : motionRef.current.revealSettled;
      updateMotion(motionRef.current.activeIndex ?? 0, motionRef.current.progress, false, {
        revealSettled,
      });
      return;
    }

    if (revealTimerRef.current) {
      clearInterval(revealTimerRef.current);
      revealTimerRef.current = null;
    }
    clearShuffleFx();

    const scanPath = buildScoreboardScanPath({
      candidateCount,
      durationMs: safeDurationMs,
      seed,
      tempo: effectiveTempo,
    });
    const effectiveStartedAtMs = startedAt ? resolveStartedAtMs(startedAt) : Date.now();
    const firstIndex = scanPath.path[0] ?? 0;
    updateMotion(firstIndex, 0, true, { revealSettled: false, resetTrail: true });

    const tick = () => {
      const now = Date.now();
      const elapsed = clamp(now - effectiveStartedAtMs, 0, safeDurationMs);
      const progress = safeDurationMs <= 0 ? 1 : elapsed / safeDurationMs;
      const nextIndex = resolveScoreboardScanIndexAtElapsed(scanPath, elapsed) ?? firstIndex;
      updateMotion(nextIndex, progress, true, { revealSettled: false });
    };

    tick();
    scanTimerRef.current = setInterval(tick, Math.max(20, Math.min(42, scanPath.tickMs)));

    return () => {
      if (scanTimerRef.current) {
        clearInterval(scanTimerRef.current);
        scanTimerRef.current = null;
      }
    };
  }, [
    candidateCount,
    clearShuffleFx,
    effectiveTempo,
    phase,
    safeDurationMs,
    seed,
    spinning,
    startedAt,
    updateMotion,
  ]);

  useEffect(() => {
    const phaseReady = phase === "picked" || phase === "confirmed" || phase === "finished";
    if (!phaseReady || !currentPickedCandidate || candidateCount <= 0) return;

    if (scanTimerRef.current) {
      clearInterval(scanTimerRef.current);
      scanTimerRef.current = null;
    }
    if (revealTimerRef.current) {
      clearInterval(revealTimerRef.current);
      revealTimerRef.current = null;
    }
    clearShuffleFx();

    const winnerIndex = normalizedCandidates.findIndex(
      (candidate) => candidate.id === currentPickedCandidate.id
    );
    if (winnerIndex < 0) {
      updateMotion(motionRef.current.activeIndex ?? 0, 1, false, { revealSettled: true });
      return;
    }

    if (phase === "confirmed" || phase === "finished") {
      updateMotion(winnerIndex, 1, false, { revealSettled: true, resetTrail: true });
      return;
    }

    if (phase !== "picked") return;

    const token = `${currentStep}:${currentPickedCandidate.id}:${seed}:${winnerIndex}:${candidateCount}`;
    if (revealTokenRef.current === token) return;
    revealTokenRef.current = token;

    const revealPath = buildScoreboardRevealPath({
      candidateCount,
      startIndex: motionRef.current.activeIndex ?? winnerIndex,
      winnerIndex,
      seed,
      tempo: effectiveTempo,
      revealDurationMs: Math.round(clamp(safeDurationMs * 0.35, 700, 2200)),
    });
    let pointer = 0;
    const total = Math.max(1, revealPath.length - 1);
    updateMotion(revealPath[0] ?? winnerIndex, 1, false, { revealSettled: false });

    revealTimerRef.current = setInterval(() => {
      pointer += 1;
      const done = pointer >= total;
      const nextIndex = revealPath[Math.min(pointer, total)] ?? winnerIndex;
      updateMotion(nextIndex, 1, false, { revealSettled: done });
      if (done && revealTimerRef.current) {
        clearInterval(revealTimerRef.current);
        revealTimerRef.current = null;
      }
    }, Math.max(24, Math.round(1000 / Math.max(1, effectiveTempo.baseHz))));

    return () => {
      if (revealTimerRef.current) {
        clearInterval(revealTimerRef.current);
        revealTimerRef.current = null;
      }
    };
  }, [
    candidateCount,
    clearShuffleFx,
    currentPickedCandidate,
    currentStep,
    effectiveTempo,
    normalizedCandidates,
    phase,
    safeDurationMs,
    seed,
    updateMotion,
  ]);

  const activeCandidate =
    motion.activeIndex === null ? null : normalizedCandidates[motion.activeIndex] ?? null;
  const winnerCandidate = currentPickedCandidate;
  const winnerIndex =
    winnerCandidate === null
      ? null
      : normalizedCandidates.findIndex((candidate) => candidate.id === winnerCandidate.id);

  const canShowWinnerText = Boolean(
    winnerCandidate &&
      (phase === "confirmed" ||
        phase === "finished" ||
        (phase === "picked" && motion.revealSettled))
  );
  const displayWinnerCandidate = canShowWinnerText ? winnerCandidate : null;
  const effectiveWinnerIndex =
    typeof winnerIndex === "number" && winnerIndex >= 0 && Boolean(displayWinnerCandidate)
      ? winnerIndex
      : null;

  const revealAllCards =
    !spinning &&
    !motion.spinning &&
    (phase === "idle" ||
      phase === "confirmed" ||
      phase === "finished" ||
      (phase === "picked" && motion.revealSettled));

  const isDeckShuffling = motion.spinning && !spinning;
  const motionStateText = spinning
    ? "LIVE SCAN"
    : isDeckShuffling
      ? "DECK SHUFFLE"
      : phase === "picked" && !motion.revealSettled
        ? "LOCKING"
        : displayWinnerCandidate
          ? "WINNER LOCKED"
          : "READY";

  const focusCandidate = displayWinnerCandidate ?? activeCandidate;
  const focusCandidateId = focusCandidate?.id ?? null;
  const focusLabelText = truncateLabel(focusCandidate?.label ?? "-", 24);
  const isMobileDrawPhase = spinning || phase === "picked";
  const mobileCardTone = displayWinnerCandidate ? "winner" : "active";
  const mobileFocusLabelText =
    isMobileDrawPhase && !displayWinnerCandidate ? "추첨중입니다." : focusLabelText;

  const stageToneClass = displayWinnerCandidate
    ? "border-emerald-300 bg-[linear-gradient(150deg,#0f172a_0%,#052e2b_45%,#022c22_100%)]"
    : isDeckShuffling
      ? "border-indigo-300 bg-[linear-gradient(150deg,#111827_0%,#312e81_45%,#0f172a_100%)]"
      : spinning || (phase === "picked" && !motion.revealSettled)
        ? "border-amber-300 bg-[linear-gradient(150deg,#111827_0%,#1f2937_42%,#0f172a_100%)]"
        : "border-slate-300 bg-[linear-gradient(150deg,#0f172a_0%,#1e293b_48%,#111827_100%)]";

  const motionChipClass = displayWinnerCandidate
    ? "border-emerald-300 bg-emerald-100 text-emerald-900"
    : isDeckShuffling
      ? "border-indigo-300 bg-indigo-100 text-indigo-900"
      : spinning || (phase === "picked" && !motion.revealSettled)
        ? "border-amber-300 bg-amber-100 text-amber-900"
        : "border-slate-300 bg-slate-100 text-slate-700";

  const progressFillClass = displayWinnerCandidate
    ? "bg-gradient-to-r from-emerald-500 via-emerald-400 to-lime-500"
    : isDeckShuffling
      ? "bg-gradient-to-r from-indigo-500 via-violet-400 to-indigo-600"
      : spinning || (phase === "picked" && !motion.revealSettled)
        ? "bg-gradient-to-r from-amber-500 via-yellow-400 to-amber-600"
        : "bg-gradient-to-r from-slate-500 to-slate-400";
  const flipDurationMs = spinning
    ? lowSpecMode
      ? 110
      : 130
    : isDeckShuffling
      ? lowSpecMode
        ? 100
        : 120
      : phase === "picked" && !motion.revealSettled
        ? lowSpecMode
          ? 130
          : 150
        : lowSpecMode
          ? 170
          : 220;

  useEffect(() => {
    let localTimer: ReturnType<typeof setTimeout> | null = null;
    if (mobileFlipTimerRef.current) {
      clearTimeout(mobileFlipTimerRef.current);
      mobileFlipTimerRef.current = null;
    }

    if (!isMobileDrawPhase || !focusCandidateId) {
      localTimer = setTimeout(() => {
        setMobileShowFront(Boolean(focusCandidateId));
      }, 0);
      return () => {
        if (localTimer) clearTimeout(localTimer);
      };
    }

    localTimer = setTimeout(() => {
      setMobileShowFront(false);
    }, 0);
    mobileFlipTimerRef.current = setTimeout(() => {
      setMobileShowFront(true);
      mobileFlipTimerRef.current = null;
    }, lowSpecMode ? 20 : 28);
    return () => {
      if (localTimer) clearTimeout(localTimer);
      if (mobileFlipTimerRef.current) {
        clearTimeout(mobileFlipTimerRef.current);
        mobileFlipTimerRef.current = null;
      }
    };
  }, [focusCandidateId, isMobileDrawPhase, lowSpecMode]);

  return (
    <div
      data-testid="draw-animator-root"
      className="flex flex-col gap-2 rounded-xl border border-slate-200 bg-white p-3 shadow-sm sm:p-4"
    >
      <div className="flex flex-wrap items-center justify-between gap-2 text-xs text-slate-500">
        <p>
          Step {Math.min(currentStep + 1, totalSteps)} / {totalSteps}
        </p>
        <div className="flex items-center gap-2">
          <span className={`rounded-full border px-2 py-0.5 font-semibold ${motionChipClass}`}>
            {motionStateText}
          </span>
          <span className="rounded-full border border-slate-200 bg-slate-50 px-2 py-0.5">
            mode: {modeText}
          </span>
          {stepPattern ? (
            <span className="rounded-full border border-slate-200 bg-slate-50 px-2 py-0.5">
              {stepPattern}
            </span>
          ) : null}
          <span className="rounded-full border border-slate-200 bg-slate-50 px-2 py-0.5">
            타겟 {targetGroupNo ?? "-"}조
          </span>
          <span className="rounded-full border border-slate-200 bg-slate-50 px-2 py-0.5">
            후보 {candidateCount}명
          </span>
        </div>
        <span
          className={`rounded-full border px-2 py-0.5 text-[11px] font-semibold ${
            displayWinnerCandidate
              ? "border-emerald-300 bg-emerald-100 text-emerald-900"
              : isDeckShuffling
                ? "border-indigo-300 bg-indigo-100 text-indigo-900"
                : "border-amber-300 bg-amber-100 text-amber-900"
          }`}
          data-testid="draw-scoreboard-focus"
        >
          {displayWinnerCandidate ? "당첨 후보" : isDeckShuffling ? "덱 셔플" : "현재 포커스"}{" "}
          {isMobileDrawPhase && !displayWinnerCandidate ? "진행중" : focusLabelText}
        </span>
      </div>

      <div
        data-testid="draw-animator-stage-wrap"
        className={`relative overflow-hidden rounded-2xl border px-3 py-3 sm:px-4 sm:py-4 ${
          lowSpecMode ? "border-slate-300 bg-slate-100" : stageToneClass
        }`}
      >
        {!lowSpecMode ? (
          <div
            className={`pointer-events-none absolute inset-0 ${
              displayWinnerCandidate
                ? "bg-[radial-gradient(circle_at_22%_18%,rgba(16,185,129,0.28),transparent_32%),radial-gradient(circle_at_80%_78%,rgba(190,242,100,0.2),transparent_38%)]"
                : isDeckShuffling
                  ? "bg-[radial-gradient(circle_at_22%_18%,rgba(129,140,248,0.24),transparent_32%),radial-gradient(circle_at_82%_80%,rgba(167,139,250,0.2),transparent_38%)]"
                  : "bg-[radial-gradient(circle_at_20%_18%,rgba(251,191,36,0.24),transparent_32%),radial-gradient(circle_at_80%_80%,rgba(245,158,11,0.18),transparent_38%)]"
            }`}
          />
        ) : null}

        <div className="relative space-y-3">
          <div
            className="h-2 overflow-hidden rounded-full bg-slate-200/80"
            data-testid="draw-scoreboard-progress"
          >
            <div
              className={`h-full rounded-full transition-[width] duration-100 ${progressFillClass}`}
              style={{ width: `${Math.max(4, motion.progress * 100)}%` }}
            />
          </div>
          {!lowSpecMode ? (
            <div className="flex flex-wrap items-center gap-2 text-[10px] text-slate-500">
              <span className="rounded-full border border-amber-300 bg-amber-100 px-2 py-0.5 font-semibold text-amber-900">
                타겟 카드 공개
              </span>
              <span className="rounded-full border border-slate-300 bg-slate-100 px-2 py-0.5 font-semibold text-slate-700">
                비타겟 카드 비공개
              </span>
              {isDeckShuffling ? (
                <span className="rounded-full border border-indigo-300 bg-indigo-100 px-2 py-0.5 font-semibold text-indigo-900">
                  셔플 연출 중
                </span>
              ) : null}
            </div>
          ) : null}

          {isMobileDrawPhase ? (
            <div className="sm:hidden">
              <div
                data-testid="draw-scoreboard-mobile-focus-card"
                data-candidate-id={focusCandidate?.id ?? ""}
                data-candidate-tone={mobileCardTone}
                data-candidate-face={mobileShowFront ? "front" : "back"}
                className="space-y-2 rounded-xl border border-slate-200/70 bg-white/80 p-3"
              >
                <div className="relative h-24 overflow-hidden rounded-xl border border-slate-200">
                  <div
                    className={`absolute inset-0 flex items-center justify-center bg-[linear-gradient(145deg,#0f172a_0%,#1e293b_100%)] text-slate-300 transition-[transform,opacity] ${
                      mobileShowFront
                        ? "opacity-0 [transform:rotateX(90deg)]"
                        : "opacity-100 [transform:rotateX(0deg)]"
                    }`}
                    style={{
                      transitionDuration: `${lowSpecMode ? 120 : 170}ms`,
                      transitionTimingFunction: "cubic-bezier(0.22,0.61,0.36,1)",
                    }}
                  >
                    <span className="text-xs font-semibold tracking-[0.24em]">DRAW</span>
                  </div>
                  <div
                    className={`absolute inset-0 flex items-center justify-center px-3 text-center transition-[transform,opacity] ${
                      displayWinnerCandidate
                        ? "bg-[linear-gradient(145deg,#d1fae5_0%,#6ee7b7_55%,#34d399_100%)] text-emerald-950"
                        : "bg-[linear-gradient(145deg,#fef3c7_0%,#fcd34d_55%,#f59e0b_100%)] text-amber-950"
                    } ${
                      mobileShowFront
                        ? "opacity-100 [transform:rotateX(0deg)]"
                        : "opacity-0 [transform:rotateX(-90deg)]"
                    }`}
                    style={{
                      transitionDuration: `${lowSpecMode ? 120 : 170}ms`,
                      transitionTimingFunction: "cubic-bezier(0.22,0.61,0.36,1)",
                    }}
                  >
                    <span className="w-full truncate text-sm font-extrabold leading-tight">
                      {mobileFocusLabelText}
                    </span>
                  </div>
                </div>
                <p className="text-center text-xs font-semibold text-slate-600">
                  {displayWinnerCandidate ? "당첨 후보 확정 중" : "추첨 중입니다..."}
                </p>
              </div>
            </div>
          ) : null}

          <div className={isMobileDrawPhase ? "hidden sm:block" : ""}>
            <CandidateGrid
              candidates={normalizedCandidates}
              activeIndex={motion.activeIndex}
              winnerIndex={effectiveWinnerIndex}
              trailIndices={motion.trailIndices}
              lowSpecMode={lowSpecMode}
              revealAll={revealAllCards}
              flipDurationMs={flipDurationMs}
            />
          </div>
        </div>
      </div>

      <LowerThird
        phase={phase}
        targetGroupNo={targetGroupNo}
        remainingCount={candidateCount}
        activeCandidate={activeCandidate}
        winnerCandidate={displayWinnerCandidate}
      />
    </div>
  );
}
