"use client";

import CandidateGrid from "../scoreboard/CandidateGrid";
import type { StageSceneState } from "./types";

interface SemanticCandidateBoardProps {
  sceneState: StageSceneState;
}

export function SemanticCandidateBoard({ sceneState }: SemanticCandidateBoardProps) {
  const winnerIndex = sceneState.winner
    ? sceneState.candidates.findIndex((candidate) => candidate.id === sceneState.winner?.id)
    : null;

  const shouldShow =
    sceneState.candidates.length > 0 &&
    sceneState.candidates.length <= 60 &&
    (sceneState.phase === "configured" ||
      sceneState.phase === "spinning" ||
      sceneState.phase === "picked");
  if (!shouldShow) return null;

  return (
    <div className="pointer-events-none absolute inset-x-8 top-24 z-10 hidden lg:block">
      <div className="[perspective:1400px]">
        <div className="rounded-2xl border border-slate-400/35 bg-slate-950/52 p-3 backdrop-blur-sm [transform:rotateX(18deg)]">
          <CandidateGrid
            candidates={sceneState.candidates}
            activeIndex={sceneState.activeIndex}
            winnerIndex={winnerIndex !== null && winnerIndex >= 0 ? winnerIndex : null}
            trailIndices={sceneState.nearMissIndexes}
            lowSpecMode={sceneState.performanceTier === "low"}
            revealAll
            flipDurationMs={150}
          />
        </div>
      </div>
    </div>
  );
}

