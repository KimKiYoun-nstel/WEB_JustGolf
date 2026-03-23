import { useMemo } from "react";
import type { StageSceneState } from "./types";
import { buildRingLayout } from "./lib/buildRingLayout";
import { CandidateCard3D } from "./CandidateCard3D";

interface CandidateRingProps {
  sceneState: StageSceneState;
}

export function CandidateRing({ sceneState }: CandidateRingProps) {
  const ringRadius = sceneState.presentationMode === "admin" ? 4 : 4.3;
  const layout = useMemo(
    () => buildRingLayout(sceneState.candidates.length, ringRadius),
    [sceneState.candidates.length, ringRadius]
  );

  return (
    <group>
      {sceneState.candidates.map((candidate, index) => {
        const transform = layout[index];
        if (!transform) return null;
        return (
          <CandidateCard3D
            key={candidate.id}
            candidate={candidate}
            position={transform.position}
            rotationY={transform.rotationY}
            phase={sceneState.phase}
          />
        );
      })}
    </group>
  );
}
