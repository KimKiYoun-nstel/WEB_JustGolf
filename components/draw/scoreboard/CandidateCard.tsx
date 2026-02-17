"use client";

import type { CSSProperties } from "react";
import type { AnimatorCandidate } from "../../../lib/draw/animators/Animator";

type CandidateTone = "active" | "near" | "trail" | "winner" | "background";

interface CandidateCardProps {
  candidate: AnimatorCandidate;
  tone: CandidateTone;
  lowSpecMode?: boolean;
  denseMode?: boolean;
  revealAll?: boolean;
  flipDurationMs?: number;
}

function truncateLabel(label: string, maxChars: number) {
  const text = label.trim();
  const chars = Array.from(text);
  if (chars.length <= maxChars) return text;
  if (maxChars <= 3) return chars.slice(0, maxChars).join("");

  const remaining = maxChars - 1;
  const head = Math.max(1, Math.ceil(remaining * 0.6));
  const tail = Math.max(1, remaining - head);
  const front = chars.slice(0, head).join("");
  const back = chars.slice(chars.length - tail).join("");
  return `${front}…${back}`;
}

function resolveFrontFaceClass(params: {
  tone: CandidateTone;
  revealAll: boolean;
  lowSpecMode: boolean;
}) {
  const { tone, revealAll, lowSpecMode } = params;
  if (tone === "winner") {
    return lowSpecMode
      ? "border-emerald-600 bg-emerald-200 text-emerald-950"
      : "border-emerald-400 bg-[linear-gradient(145deg,#d1fae5_0%,#6ee7b7_50%,#34d399_100%)] text-emerald-950 shadow-[0_0_22px_rgba(16,185,129,0.42)]";
  }

  if (tone === "active") {
    return lowSpecMode
      ? "border-amber-600 bg-amber-200 text-amber-950"
      : "border-amber-400 bg-[linear-gradient(145deg,#fef3c7_0%,#fcd34d_52%,#f59e0b_100%)] text-amber-950 shadow-[0_0_22px_rgba(245,158,11,0.45)]";
  }

  if (revealAll) {
    return "border-slate-300 bg-white text-slate-900";
  }

  return "border-slate-300 bg-slate-100 text-slate-700";
}

export default function CandidateCard({
  candidate,
  tone,
  lowSpecMode = false,
  denseMode = false,
  revealAll = false,
  flipDurationMs,
}: CandidateCardProps) {
  const isWinner = tone === "winner";
  const isActive = tone === "active";
  const isFocused = isWinner || isActive;
  const showFront = revealAll || isFocused;
  const label = truncateLabel(candidate.label, denseMode ? 10 : 14);
  const transitionDurationMs = Math.max(
    90,
    Math.min(520, Math.round(flipDurationMs ?? (lowSpecMode ? 120 : 150)))
  );

  const flipStyle: CSSProperties = {
    transitionDuration: `${transitionDurationMs}ms`,
    transitionTimingFunction: "cubic-bezier(0.22,0.61,0.36,1)",
  };

  const frontFaceClass = resolveFrontFaceClass({
    tone,
    revealAll,
    lowSpecMode,
  });
  const backFaceClass =
    "border-slate-700 bg-[linear-gradient(145deg,#0f172a_0%,#1e293b_100%)] text-slate-300";
  const faceBaseClass =
    "absolute inset-0 flex items-center justify-center rounded-lg border px-2 text-center transition-[transform,opacity]";

  return (
    <div
      className="relative h-12 [perspective:960px] sm:h-14"
      data-testid="draw-scoreboard-candidate"
      data-candidate-tone={tone}
      data-candidate-face={showFront ? "front" : "back"}
      data-candidate-id={candidate.id}
    >
      <div className="relative h-full w-full rounded-lg">
        <div
          className={`${faceBaseClass} ${backFaceClass} ${
            showFront ? "opacity-0 [transform:rotateX(90deg)]" : "opacity-100 [transform:rotateX(0deg)]"
          }`}
          style={flipStyle}
          aria-hidden={showFront}
        >
          <span className="text-[11px] font-semibold tracking-[0.24em] text-slate-400">CARD</span>
        </div>
        <div
          className={`${faceBaseClass} ${frontFaceClass} ${
            isFocused && !lowSpecMode ? "ring-2 ring-white/70" : ""
          } ${
            showFront ? "opacity-100 [transform:rotateX(0deg)]" : "opacity-0 [transform:rotateX(-90deg)]"
          }`}
          style={flipStyle}
          aria-hidden={!showFront}
        >
          <span className="w-full truncate text-center text-[12px] font-extrabold leading-tight sm:text-[13px]">
            {label}
          </span>
        </div>
      </div>
    </div>
  );
}
