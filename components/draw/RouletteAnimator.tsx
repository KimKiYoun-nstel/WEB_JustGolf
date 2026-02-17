"use client";

import { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState } from "react";
import type { CSSProperties } from "react";
import type { AnimatorProps } from "../../lib/draw/animators/Animator";

function clamp(value: number, min: number, max: number) {
  return Math.max(min, Math.min(max, value));
}

function wrapIndex(index: number, length: number) {
  if (length <= 0) return 0;
  return ((index % length) + length) % length;
}

function wrapDegrees(value: number) {
  return ((value % 360) + 360) % 360;
}

function formatSegmentLabel(label: string) {
  return Array.from(label.trim()).slice(0, 8).join("");
}

function toVerticalStack(label: string) {
  return Array.from(formatSegmentLabel(label)).join("\n");
}

const FALLBACK_SEGMENTS = 6;
const WHEEL_SIZE = 520;
const WHEEL_RADIUS = WHEEL_SIZE / 2;
const DISPLAY_SLOT_COUNT = 12;
const SEGMENT_COLORS = [
  "#ff5f7a",
  "#2f4b9a",
  "#ff9f68",
  "#2b7a8a",
  "#a24cc2",
  "#f0b43c",
  "#2a9d8f",
  "#e05263",
];

export default function RouletteAnimator({
  phase,
  durationMs,
  startedAt,
  currentPickLabel,
  candidateLabels = [],
  currentStep,
  totalSteps,
  lowSpecMode = false,
}: AnimatorProps) {
  const wheelDuration = clamp(durationMs ?? 4200, 1000, 15000);
  const spinning = phase === "configured";
  const showMotion = spinning && !lowSpecMode;

  const initialLabel = candidateLabels.find((label) => Boolean(label && label.trim())) ?? "-";

  const [rotationDeg, setRotationDeg] = useState(0);
  const [progressNow, setProgressNow] = useState(() => Date.now());
  const [lockedCandidates, setLockedCandidates] = useState<string[]>([]);
  const [pointerNudgePx, setPointerNudgePx] = useState(0);

  const [reelFromLabel, setReelFromLabel] = useState(initialLabel);
  const [reelToLabel, setReelToLabel] = useState(initialLabel);
  const [reelAnimating, setReelAnimating] = useState(false);

  const animationRafRef = useRef<number | null>(null);
  const spinProgressTimerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const prevFrameTsRef = useRef<number | null>(null);
  const pointerNudgeTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const wheelBoundaryRef = useRef<number | null>(null);
  const rotationRef = useRef(0);

  const reelTickTimerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const reelAnimTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const reelCurrentLabelRef = useRef(initialLabel);
  const reelPendingLabelRef = useRef<string | null>(null);
  const reelBusyRef = useRef(false);

  const spinSessionRef = useRef<string | null>(null);
  const rollingLabelRef = useRef(initialLabel);

  const candidates = useMemo(
    () => candidateLabels.filter((label) => Boolean(label && label.trim())),
    [candidateLabels]
  );

  const stopAnimationLoop = useCallback(() => {
    if (animationRafRef.current !== null) {
      cancelAnimationFrame(animationRafRef.current);
      animationRafRef.current = null;
    }
    prevFrameTsRef.current = null;
  }, []);

  const pulsePointer = useCallback(() => {
    setPointerNudgePx(8);
    if (pointerNudgeTimerRef.current) clearTimeout(pointerNudgeTimerRef.current);
    pointerNudgeTimerRef.current = setTimeout(() => setPointerNudgePx(0), 110);
  }, []);

  useEffect(() => {
    return () => {
      stopAnimationLoop();
      if (spinProgressTimerRef.current) clearInterval(spinProgressTimerRef.current);
      if (reelTickTimerRef.current) clearInterval(reelTickTimerRef.current);
      if (reelAnimTimerRef.current) clearTimeout(reelAnimTimerRef.current);
      if (pointerNudgeTimerRef.current) clearTimeout(pointerNudgeTimerRef.current);
    };
  }, [stopAnimationLoop]);

  const effectiveCandidates = lockedCandidates.length > 0 ? lockedCandidates : candidates;
  const hasCandidates = effectiveCandidates.length > 0;
  const virtualSegmentCount = hasCandidates ? effectiveCandidates.length : FALLBACK_SEGMENTS;
  const virtualSegmentAngle = 360 / virtualSegmentCount;
  const visibleSegmentCount = DISPLAY_SLOT_COUNT;
  const visibleSegmentAngle = 360 / visibleSegmentCount;

  useEffect(() => {
    if (phase === "configured" || phase === "picked") return;
    setLockedCandidates(candidates.length > 0 ? [...candidates] : []);
  }, [phase, candidates]);

  const applyRotation = useCallback(
    (nextRotation: number) => {
      rotationRef.current = nextRotation;
      const normalized = wrapDegrees(-nextRotation);
      const boundary = Math.floor(normalized / visibleSegmentAngle);
      const prevBoundary = wheelBoundaryRef.current;
      if (prevBoundary !== null && boundary !== prevBoundary) {
        pulsePointer();
      }
      wheelBoundaryRef.current = boundary;
      setRotationDeg(nextRotation);
    },
    [pulsePointer, visibleSegmentAngle]
  );

  useLayoutEffect(() => {
    if (!spinning) return;

    const sessionKey = startedAt ?? `step-${currentStep}`;
    if (spinSessionRef.current === sessionKey) return;

    spinSessionRef.current = sessionKey;
    setLockedCandidates(candidates.length > 0 ? [...candidates] : []);
    wheelBoundaryRef.current = Math.floor(
      wrapDegrees(-rotationRef.current) / visibleSegmentAngle
    );
  }, [spinning, startedAt, currentStep, candidates, visibleSegmentAngle]);

  useEffect(() => {
    if (!showMotion || effectiveCandidates.length <= 1) return;

    stopAnimationLoop();
    const startedTs = startedAt ? new Date(startedAt).getTime() : Date.now();

    const frame = (frameTs: number) => {
      const prevTs = prevFrameTsRef.current ?? frameTs;
      prevFrameTsRef.current = frameTs;
      const dtSec = Math.max(0.01, Math.min(0.06, (frameTs - prevTs) / 1000));
      const nowTs = Date.now();
      const elapsed = Math.max(0, nowTs - startedTs);
      const progress = clamp(elapsed / wheelDuration, 0, 1);
      const velocityDegPerSec =
        progress >= 1 ? 92 : Math.max(92, 920 * (1 - progress) ** 2.15);
      const deltaDeg = velocityDegPerSec * dtSec;

      setProgressNow(nowTs);
      applyRotation(rotationRef.current + deltaDeg);

      animationRafRef.current = requestAnimationFrame(frame);
    };

    animationRafRef.current = requestAnimationFrame(frame);

    return stopAnimationLoop;
  }, [
    showMotion,
    effectiveCandidates.length,
    startedAt,
    wheelDuration,
    applyRotation,
    stopAnimationLoop,
  ]);

  useEffect(() => {
    if (!spinning || showMotion || !startedAt) return;

    spinProgressTimerRef.current = setInterval(() => {
      setProgressNow(Date.now());
    }, 80);

    return () => {
      if (spinProgressTimerRef.current) {
        clearInterval(spinProgressTimerRef.current);
        spinProgressTimerRef.current = null;
      }
    };
  }, [spinning, showMotion, startedAt]);

  useEffect(() => {
    if (phase !== "picked" || !currentPickLabel || effectiveCandidates.length === 0) return;

    stopAnimationLoop();

    const pickedIdx = effectiveCandidates.findIndex((name) => name === currentPickLabel);
    if (pickedIdx < 0) return;

    const targetCenterDeg =
      pickedIdx * virtualSegmentAngle + virtualSegmentAngle / 2;
    const targetRotationMod = wrapDegrees(-targetCenterDeg);
    const currentMod = wrapDegrees(rotationRef.current);
    let settleDelta = wrapDegrees(targetRotationMod - currentMod);
    if (settleDelta < Math.max(10, virtualSegmentAngle * 0.35)) {
      settleDelta += 360;
    }
    const settleDuration = Math.max(1000, Math.min(1800, Math.round(wheelDuration * 0.55)));
    const settleFrom = rotationRef.current;
    const settleStart = performance.now();

    const settleFrame = (frameTs: number) => {
      const t = clamp((frameTs - settleStart) / settleDuration, 0, 1);
      const eased = 1 - (1 - t) ** 4;
      applyRotation(settleFrom + settleDelta * eased);
      if (t < 1) {
        animationRafRef.current = requestAnimationFrame(settleFrame);
      } else {
        stopAnimationLoop();
      }
    };

    animationRafRef.current = requestAnimationFrame(settleFrame);
    return stopAnimationLoop;
  }, [
    phase,
    currentPickLabel,
    effectiveCandidates,
    virtualSegmentAngle,
    wheelDuration,
    applyRotation,
    stopAnimationLoop,
  ]);

  const pointerCandidateIndex = useMemo(() => {
    const normalized = wrapDegrees(-rotationDeg);
    const idx = Math.floor(normalized / virtualSegmentAngle);
    return wrapIndex(idx, virtualSegmentCount);
  }, [rotationDeg, virtualSegmentAngle, virtualSegmentCount]);

  const visiblePointerSegmentIndex = useMemo(() => {
    const normalized = wrapDegrees(-rotationDeg);
    const idx = Math.floor(normalized / visibleSegmentAngle);
    return wrapIndex(idx, visibleSegmentCount);
  }, [rotationDeg, visibleSegmentAngle, visibleSegmentCount]);

  const wheelLabels = useMemo(() => {
    if (!hasCandidates) {
      return Array.from({ length: visibleSegmentCount }, (_, idx) => `후보${idx + 1}`);
    }
    return Array.from({ length: visibleSegmentCount }, (_, slotIdx) => {
      const delta = slotIdx - visiblePointerSegmentIndex;
      const candidateIdx = wrapIndex(
        pointerCandidateIndex + delta,
        effectiveCandidates.length
      );
      return effectiveCandidates[candidateIdx];
    });
  }, [
    hasCandidates,
    visibleSegmentCount,
    effectiveCandidates,
    visiblePointerSegmentIndex,
    pointerCandidateIndex,
  ]);

  const rollingLabel =
    effectiveCandidates.length > 0
      ? effectiveCandidates[wrapIndex(pointerCandidateIndex, effectiveCandidates.length)]
      : null;

  const displayedLabel = phase === "picked" ? currentPickLabel ?? rollingLabel : rollingLabel;
  const elapsedMs = startedAt ? Math.max(0, progressNow - new Date(startedAt).getTime()) : 0;
  const progress = spinning ? clamp(elapsedMs / wheelDuration, 0, 1) : 0;

  useEffect(() => {
    rollingLabelRef.current = rollingLabel ?? "-";
  }, [rollingLabel]);

  const performReelFlip = useCallback((nextRawLabel: string, force = false) => {
    const nextLabel = nextRawLabel || "-";
    const current = reelCurrentLabelRef.current || "-";

    if (!force && reelBusyRef.current) {
      reelPendingLabelRef.current = nextLabel;
      return;
    }
    if (current === nextLabel) return;

    reelBusyRef.current = true;
    setReelFromLabel(current);
    setReelToLabel(nextLabel);
    setReelAnimating(true);

    if (reelAnimTimerRef.current) clearTimeout(reelAnimTimerRef.current);
    reelAnimTimerRef.current = setTimeout(() => {
      reelCurrentLabelRef.current = nextLabel;
      setReelFromLabel(nextLabel);
      setReelToLabel(nextLabel);
      setReelAnimating(false);
      reelBusyRef.current = false;

      const pending = reelPendingLabelRef.current;
      reelPendingLabelRef.current = null;
      if (pending && pending !== nextLabel) {
        performReelFlip(pending, true);
      }
    }, 520);
  }, []);

  useEffect(() => {
    const init = displayedLabel ?? "-";
    reelCurrentLabelRef.current = init;
    setReelFromLabel(init);
    setReelToLabel(init);
    setReelAnimating(false);
    // mount once
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    if (reelTickTimerRef.current) {
      clearInterval(reelTickTimerRef.current);
      reelTickTimerRef.current = null;
    }

    if (spinning && effectiveCandidates.length > 0) {
      reelTickTimerRef.current = setInterval(() => {
        performReelFlip(rollingLabelRef.current);
      }, 680);
    }

    return () => {
      if (reelTickTimerRef.current) {
        clearInterval(reelTickTimerRef.current);
        reelTickTimerRef.current = null;
      }
    };
  }, [spinning, effectiveCandidates.length, performReelFlip]);

  useEffect(() => {
    if (phase === "picked" && currentPickLabel) {
      performReelFlip(currentPickLabel, true);
      return;
    }
    if (!spinning) {
      performReelFlip(displayedLabel ?? "-", true);
    }
  }, [phase, currentPickLabel, spinning, displayedLabel, performReelFlip]);

  const wheelGradient = useMemo(() => {
    const separatorDeg = Math.max(1.1, Math.min(2.2, visibleSegmentAngle * 0.12));
    const paletteSize = SEGMENT_COLORS.length;
    const seed = visibleSegmentCount % paletteSize;
    const step = 3;
    const segmentColors = Array.from({ length: visibleSegmentCount }, (_, idx) => {
      let color = SEGMENT_COLORS[(seed + idx * step) % paletteSize];
      if (idx > 0 && color === SEGMENT_COLORS[(seed + (idx - 1) * step) % paletteSize]) {
        color = SEGMENT_COLORS[(seed + idx * step + 1) % paletteSize];
      }
      return color;
    });

    if (
      visibleSegmentCount > 1 &&
      segmentColors[0] === segmentColors[visibleSegmentCount - 1]
    ) {
      const lastPaletteIdx = SEGMENT_COLORS.indexOf(
        segmentColors[visibleSegmentCount - 1]
      );
      let replacement = SEGMENT_COLORS[(lastPaletteIdx + 2) % paletteSize];
      if (
        visibleSegmentCount > 2 &&
        replacement === segmentColors[visibleSegmentCount - 2]
      ) {
        replacement = SEGMENT_COLORS[(lastPaletteIdx + 3) % paletteSize];
      }
      segmentColors[visibleSegmentCount - 1] = replacement;
    }

    return Array.from({ length: visibleSegmentCount }, (_, idx) => {
      const start = idx * visibleSegmentAngle;
      const end = (idx + 1) * visibleSegmentAngle;
      const color = segmentColors[idx];
      const colorEnd = Math.max(start, end - separatorDeg);
      return `${color} ${start}deg ${colorEnd}deg, #edf3ff ${colorEnd}deg ${end}deg`;
    }).join(", ");
  }, [visibleSegmentCount, visibleSegmentAngle]);

  const labelStartRadius = WHEEL_RADIUS - 28;
  const labelFontSize = clamp(Math.round(13 + visibleSegmentAngle * 0.14), 13, 18);
  const labelHeight = clamp(Math.round(labelFontSize * 8.6), 112, 154);

  const wheelStyle: CSSProperties = {
    width: WHEEL_SIZE,
    height: WHEEL_SIZE,
    borderRadius: "9999px",
    border: "11px solid #c2d1e7",
    background: `conic-gradient(from -90deg, ${wheelGradient})`,
    boxShadow: "inset 0 10px 18px rgba(15,23,42,0.18), 0 12px 30px rgba(15,23,42,0.15)",
    transform: `rotate(${rotationDeg}deg)`,
    position: "relative",
    overflow: "hidden",
    willChange: "transform",
  };

  const reelTrackStyle: CSSProperties = {
    height: "200%",
    transform: reelAnimating ? "translateY(-50%)" : "translateY(0)",
    transition: "transform 560ms cubic-bezier(0.2, 0.8, 0.2, 1)",
    willChange: "transform",
  };

  return (
    <div className="flex flex-col items-center gap-4 rounded-xl border border-slate-200 bg-white p-6 shadow-sm">
      <div className="text-sm text-slate-500">
        Step {Math.min(currentStep + 1, totalSteps)} / {totalSteps}
      </div>

      <div className="relative h-[320px] w-full max-w-[680px] overflow-hidden rounded-2xl border border-slate-200 bg-[linear-gradient(180deg,#f7f9ff_0%,#eaf0fc_100%)]">
        <div
          aria-hidden="true"
          className="absolute left-1/2 top-[32px] z-20 h-0 w-0 border-l-[15px] border-r-[15px] border-t-[28px] border-l-transparent border-r-transparent border-t-rose-600 drop-shadow-[0_2px_2px_rgba(15,23,42,0.35)]"
          style={{
            transform: `translate(-50%, ${pointerNudgePx}px)`,
            transition: "transform 110ms ease-out",
          }}
        />

        <div aria-hidden="true" className="absolute left-1/2 top-[58px] -translate-x-1/2" style={wheelStyle}>
          <div className="absolute inset-[10px] rounded-full border border-white/35" />

          {wheelLabels.map((label, idx) => {
            const angleDeg = (idx + 0.5) * visibleSegmentAngle - 90;
            const angleRad = (angleDeg * Math.PI) / 180;
            const x = WHEEL_RADIUS + Math.cos(angleRad) * labelStartRadius;
            const y = WHEEL_RADIUS + Math.sin(angleRad) * labelStartRadius;
            const isPointed = idx === visiblePointerSegmentIndex;
            const radialDeg = angleDeg + 90;

            return (
              <span
                key={`${idx}-${label}`}
                className={isPointed ? "font-extrabold text-amber-100" : "font-semibold text-white/95"}
                style={{
                  position: "absolute",
                  left: `${x}px`,
                  top: `${y}px`,
                  transform: `translate(-50%, 0) rotate(${radialDeg}deg)`,
                  transformOrigin: "50% 0%",
                  fontFamily:
                    "'Pretendard Variable', 'Pretendard', 'SUIT Variable', 'Noto Sans KR', 'Malgun Gothic', sans-serif",
                  width: "1.08em",
                  height: `${labelHeight}px`,
                  display: "flex",
                  alignItems: "flex-start",
                  justifyContent: "center",
                  fontSize: `${labelFontSize}px`,
                  lineHeight: 1,
                  whiteSpace: "pre",
                  textShadow: "0 1px 2px rgba(2,6,23,0.82)",
                  pointerEvents: "none",
                  opacity: isPointed ? 1 : 0.92,
                  textAlign: "center",
                  overflow: "hidden",
                  letterSpacing: "-0.02em",
                }}
                title={label}
              >
                {toVerticalStack(label)}
              </span>
            );
          })}
        </div>
      </div>

      <div className="w-full max-w-md space-y-2 text-center">
        <p className="text-xs text-slate-500">
          남은 후보 {candidates.length}명
          {spinning ? ` · 연출 ${(progress * 100).toFixed(0)}%` : ""}
        </p>

        <div className="rounded-lg border border-slate-200 bg-slate-50 px-4 py-3">
          <p className="text-xs text-slate-500">바늘이 가리키는 후보</p>
          <div className="mx-auto mt-2 h-16 w-full max-w-[390px] rounded-xl border border-slate-300 bg-gradient-to-b from-slate-200 to-slate-100 p-2 shadow-[inset_0_2px_3px_rgba(15,23,42,0.14)]">
            <div className="relative h-full w-full overflow-hidden rounded-md">
              <div className="pointer-events-none absolute inset-x-0 top-0 z-10 h-4 bg-gradient-to-b from-slate-50/95 to-transparent" />
              <div className="pointer-events-none absolute inset-x-0 bottom-0 z-10 h-4 bg-gradient-to-t from-slate-50/95 to-transparent" />
              <div style={reelTrackStyle}>
                <div className="flex h-1/2 items-center justify-center rounded-md border border-slate-300 bg-white px-3 text-xl font-semibold text-slate-700 shadow-[0_6px_16px_-9px_rgba(15,23,42,0.45)]">
                  {reelFromLabel}
                </div>
                <div
                  className={`flex h-1/2 items-center justify-center rounded-md border border-slate-300 bg-white px-3 text-xl font-semibold shadow-[0_6px_16px_-9px_rgba(15,23,42,0.45)] ${
                    phase === "picked" ? "text-emerald-700" : "text-slate-800"
                  }`}
                >
                  {reelToLabel}
                </div>
              </div>
            </div>
          </div>
        </div>

        {spinning && (
          <div className="h-2 overflow-hidden rounded-full bg-slate-200">
            <div
              className="h-full rounded-full bg-rose-500 transition-[width] duration-150"
              style={{ width: `${Math.max(5, progress * 100)}%` }}
            />
          </div>
        )}

        {phase === "configured" && <p className="text-sm font-medium text-rose-600">룰렛 추첨 중...</p>}
        {phase === "picked" && (
          <p className="text-sm font-semibold text-emerald-700">당첨: {currentPickLabel ?? "-"}</p>
        )}
        {phase !== "configured" && phase !== "picked" && (
          <p className="text-sm text-slate-500">다음 스텝을 준비하세요.</p>
        )}
      </div>
    </div>
  );
}
