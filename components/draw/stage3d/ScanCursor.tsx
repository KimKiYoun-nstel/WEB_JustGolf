import { useMemo } from "react";
import type { StageSceneState } from "./types";
import { buildRingLayout } from "./lib/buildRingLayout";

interface ScanCursorProps {
  sceneState: StageSceneState;
}

function resolveRingRadius(sceneState: StageSceneState) {
  return sceneState.presentationMode === "admin" ? 4 : 4.3;
}

export function ScanCursor({ sceneState }: ScanCursorProps) {
  const layout = useMemo(
    () => buildRingLayout(sceneState.candidates.length, resolveRingRadius(sceneState)),
    [sceneState.candidates.length, sceneState.presentationMode]
  );

  const focusIndex =
    sceneState.activeIndex ??
    (sceneState.winner
      ? sceneState.candidates.findIndex((candidate) => candidate.id === sceneState.winner?.id)
      : null);

  if (focusIndex === null || focusIndex < 0) return null;
  const transform = layout[focusIndex];
  if (!transform) return null;

  const pulse =
    sceneState.phase === "spinning"
      ? 0.7 + Math.sin(sceneState.elapsedMs * 0.015) * 0.25
      : sceneState.phase === "picked"
        ? 0.95
        : 0.6;

  return (
    <group
      position={[transform.position[0], transform.position[1] + 0.34, transform.position[2]]}
      rotation={[0, transform.rotationY, 0]}
    >
      <mesh position={[0, 0.16, 0]}>
        <coneGeometry args={[0.09, 0.22, 3]} />
        <meshBasicMaterial color="#fbbf24" transparent opacity={pulse} />
      </mesh>
      <mesh rotation={[Math.PI / 2, 0, 0]} position={[0, -0.05, 0]}>
        <ringGeometry args={[0.18, 0.26, 28]} />
        <meshBasicMaterial color="#fde68a" transparent opacity={Math.min(1, pulse + 0.12)} />
      </mesh>
    </group>
  );
}

