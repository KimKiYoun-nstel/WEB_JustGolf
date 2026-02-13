"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import type { CSSProperties } from "react";
import type { AnimatorProps } from "../../lib/draw/animators/Animator";

function clamp(value: number, min: number, max: number) {
  return Math.max(min, Math.min(max, value));
}

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
  const wheelDuration = Math.max(1200, durationMs ?? 3500);
  const spinning = phase === "configured";
  const showMotion = spinning && !lowSpecMode;

  const candidates = useMemo(
    () => candidateLabels.filter((label) => Boolean(label && label.trim())),
    [candidateLabels]
  );
  const [rollingIndex, setRollingIndex] = useState(0);
  const [progressNow, setProgressNow] = useState(() => Date.now());
  const rollingTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    if (!showMotion || candidates.length === 0) return;

    const startedTs = startedAt ? new Date(startedAt).getTime() : Date.now();

    const tick = () => {
      setProgressNow(Date.now());
      setRollingIndex((prev) => {
        const jump = 1 + Math.floor(Math.random() * 3);
        return (prev + jump) % candidates.length;
      });

      const elapsed = Date.now() - startedTs;
      const progress = clamp(elapsed / wheelDuration, 0, 1);
      const delay = Math.round(55 + progress * 130);
      rollingTimerRef.current = setTimeout(tick, delay);
    };

    tick();

    return () => {
      if (rollingTimerRef.current) {
        clearTimeout(rollingTimerRef.current);
      }
    };
  }, [showMotion, candidates, startedAt, wheelDuration]);

  useEffect(() => {
    if (!spinning || !startedAt) return;

    const timer = setInterval(() => {
      setProgressNow(Date.now());
    }, 80);

    return () => {
      clearInterval(timer);
    };
  }, [spinning, startedAt]);

  useEffect(() => {
    if (phase === "picked" && currentPickLabel && candidates.length > 0) {
      const idx = candidates.findIndex((name) => name === currentPickLabel);
      if (idx >= 0) {
        const timer = setTimeout(() => {
          setRollingIndex(idx);
        }, 0);
        return () => clearTimeout(timer);
      }
    }
  }, [phase, currentPickLabel, candidates]);

  const rollingLabel =
    candidates.length > 0 ? candidates[rollingIndex % candidates.length] : null;

  const elapsedMs = startedAt ? Math.max(0, progressNow - new Date(startedAt).getTime()) : 0;
  const progress = spinning ? clamp(elapsedMs / wheelDuration, 0, 1) : 0;

  const displayedLabel =
    phase === "picked" ? currentPickLabel ?? rollingLabel : rollingLabel;

  const orbitCount = clamp(candidates.length === 0 ? 8 : candidates.length, 8, 14);
  const orbitBalls = Array.from({ length: orbitCount }, (_, idx) => {
    const angle = (360 / orbitCount) * idx;
    const label = candidates.length > 0 ? candidates[(rollingIndex + idx) % candidates.length] : "";
    return { angle, label, idx };
  });

  const wheelStyle: CSSProperties = {
    width: 232,
    height: 232,
    borderRadius: "9999px",
    border: "12px solid #cbd5e1",
    background:
      "conic-gradient(#e11d48 0deg 30deg, #0f172a 30deg 60deg, #e11d48 60deg 90deg, #0f172a 90deg 120deg, #e11d48 120deg 150deg, #0f172a 150deg 180deg, #e11d48 180deg 210deg, #0f172a 210deg 240deg, #e11d48 240deg 270deg, #0f172a 270deg 300deg, #e11d48 300deg 330deg, #0f172a 330deg 360deg)",
    boxShadow: "inset 0 8px 18px rgba(15,23,42,0.22), 0 6px 20px rgba(15,23,42,0.12)",
    position: "relative",
    animation: showMotion ? `rouletteSpin ${Math.max(450, Math.round(wheelDuration / 2.5))}ms linear infinite` : undefined,
  };

  return (
    <div className="flex flex-col items-center gap-4 rounded-xl border border-slate-200 bg-white p-6 shadow-sm">
      <div className="text-sm text-slate-500">
        Step {Math.min(currentStep + 1, totalSteps)} / {totalSteps}
      </div>

      <div className="relative flex h-[250px] w-[250px] items-center justify-center">
        <div
          aria-hidden="true"
          style={{
            position: "absolute",
            top: -2,
            left: "50%",
            transform: "translateX(-50%)",
            width: 0,
            height: 0,
            borderLeft: "14px solid transparent",
            borderRight: "14px solid transparent",
            borderTop: "24px solid #e11d48",
            filter: "drop-shadow(0 1px 1px rgba(15, 23, 42, 0.35))",
            zIndex: 4,
          }}
        />

        <div aria-hidden="true" style={wheelStyle}>
          <div
            style={{
              position: "absolute",
              inset: 14,
              borderRadius: "9999px",
              border: "2px solid rgba(255,255,255,0.45)",
            }}
          />
          <div
            style={{
              position: "absolute",
              inset: 32,
              borderRadius: "9999px",
              animation: showMotion ? "rouletteSpinReverse 1700ms linear infinite" : undefined,
            }}
          >
            {orbitBalls.map((ball) => {
              const radius = 78;
              const rad = (ball.angle * Math.PI) / 180;
              const x = Math.cos(rad) * radius;
              const y = Math.sin(rad) * radius;
              const isActive = phase === "configured" && ball.idx === 0;

              return (
                <div
                  key={`${ball.idx}-${ball.label}`}
                  style={{
                    position: "absolute",
                    left: "50%",
                    top: "50%",
                    transform: `translate(calc(-50% + ${x}px), calc(-50% + ${y}px))`,
                    width: isActive ? 26 : 20,
                    height: isActive ? 26 : 20,
                    borderRadius: "9999px",
                    background: isActive ? "#fde68a" : "#f8fafc",
                    border: `2px solid ${isActive ? "#f59e0b" : "#64748b"}`,
                    boxShadow: "0 2px 5px rgba(15,23,42,0.18)",
                  }}
                  title={ball.label}
                />
              );
            })}
          </div>

          <div
            style={{
              position: "absolute",
              left: "50%",
              top: "50%",
              transform: "translate(-50%, -50%)",
              width: 104,
              height: 104,
              borderRadius: "9999px",
              border: "2px solid #94a3b8",
              background: "radial-gradient(circle at 30% 30%, #ffffff, #e2e8f0)",
              boxShadow: "0 2px 6px rgba(15,23,42,0.2)",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              zIndex: 3,
            }}
          >
            <div
              style={{
                width: 14,
                height: 14,
                borderRadius: "9999px",
                background: "#e11d48",
              }}
            />
          </div>
        </div>
      </div>

      <div className="w-full max-w-md space-y-2 text-center">
        <p className="text-xs text-slate-500">
          남은 후보 {candidates.length}명
          {spinning ? ` · 연출 ${(progress * 100).toFixed(0)}%` : ""}
        </p>

        <div className="rounded-lg border border-slate-200 bg-slate-50 px-4 py-3">
          <p className="text-xs text-slate-500">현재 후보</p>
          <p
            className={`text-base font-semibold ${
              phase === "picked" ? "text-emerald-700" : "text-slate-800"
            }`}
          >
            {displayedLabel ?? "-"}
          </p>
        </div>

        {spinning && (
          <div className="h-2 overflow-hidden rounded-full bg-slate-200">
            <div
              className="h-full rounded-full bg-rose-500 transition-[width] duration-150"
              style={{ width: `${Math.max(5, progress * 100)}%` }}
            />
          </div>
        )}

        {phase === "configured" && (
          <p className="text-sm font-medium text-rose-600">룰렛 추첨 중...</p>
        )}
        {phase === "picked" && (
          <p className="text-sm font-semibold text-emerald-700">당첨: {currentPickLabel ?? "-"}</p>
        )}
        {phase !== "configured" && phase !== "picked" && (
          <p className="text-sm text-slate-500">다음 스텝을 준비하세요.</p>
        )}
      </div>

      <style jsx global>{`
        @keyframes rouletteSpin {
          from {
            transform: rotate(0deg);
          }
          to {
            transform: rotate(360deg);
          }
        }

        @keyframes rouletteSpinReverse {
          from {
            transform: rotate(360deg);
          }
          to {
            transform: rotate(0deg);
          }
        }
      `}</style>
    </div>
  );
}
