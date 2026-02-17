"use client";

import type { AnimatorCandidate } from "../../../lib/draw/animators/Animator";
import CandidateCard from "./CandidateCard";

interface CandidateGridProps {
  candidates: AnimatorCandidate[];
  activeIndex: number | null;
  winnerIndex: number | null;
  trailIndices: number[];
  lowSpecMode?: boolean;
  revealAll?: boolean;
  flipDurationMs?: number;
}

function resolveGridColumnsClass(count: number) {
  if (count <= 12) return "grid-cols-3 sm:grid-cols-4 md:grid-cols-6";
  if (count <= 24) return "grid-cols-4 sm:grid-cols-6 md:grid-cols-8";
  if (count <= 48) return "grid-cols-5 sm:grid-cols-8 md:grid-cols-10";
  return "grid-cols-6 sm:grid-cols-9 md:grid-cols-12";
}

export default function CandidateGrid({
  candidates,
  activeIndex,
  winnerIndex,
  trailIndices,
  lowSpecMode = false,
  revealAll = false,
  flipDurationMs,
}: CandidateGridProps) {
  void trailIndices;
  const count = candidates.length;
  const denseMode = count > 28;

  return (
    <div
      data-testid="draw-scoreboard-grid"
      className={`grid gap-1.5 sm:gap-2 ${resolveGridColumnsClass(count)}`}
    >
      {candidates.map((candidate, index) => {
        let tone: "active" | "near" | "trail" | "winner" | "background" = "background";
        if (winnerIndex !== null && index === winnerIndex) {
          tone = "winner";
        } else if (activeIndex !== null && index === activeIndex) {
          tone = "active";
        }

        return (
          <CandidateCard
            key={candidate.id}
            candidate={candidate}
            tone={tone}
            lowSpecMode={lowSpecMode}
            denseMode={denseMode}
            revealAll={revealAll}
            flipDurationMs={flipDurationMs}
          />
        );
      })}
    </div>
  );
}
