import { Line } from "@react-three/drei";
import { useMemo } from "react";
import { CatmullRomCurve3, Vector3 } from "three";
import type { StageSceneState } from "./types";
import { buildWallLayout } from "./lib/buildWallLayout";

interface AssignmentArcProps {
  sceneState: StageSceneState;
}

function resolveGroupCount(sceneState: StageSceneState) {
  const knownMax = Math.max(sceneState.targetGroupNo ?? 0, sceneState.assignGroupNo ?? 0);
  return Math.max(4, knownMax);
}

function resolveTargetPosition(sceneState: StageSceneState): Vector3 {
  const groupNo = sceneState.assignGroupNo ?? sceneState.targetGroupNo ?? 1;
  const total = resolveGroupCount(sceneState);
  const angle = ((groupNo - 1) / total) * Math.PI * 2;
  const radius = 7.3;
  return new Vector3(Math.cos(angle) * radius, 1.4, Math.sin(angle) * radius);
}

export function AssignmentArc({ sceneState }: AssignmentArcProps) {
  const shouldShow = sceneState.phase === "assigning" || sceneState.phase === "finished";

  const points = useMemo(() => {
    const wallLayout = buildWallLayout(sceneState.candidates.length);
    const winnerIndex = sceneState.winner
      ? sceneState.candidates.findIndex((candidate) => candidate.id === sceneState.winner?.id)
      : -1;
    const winnerTransform = winnerIndex >= 0 ? wallLayout.transforms[winnerIndex] : null;
    const candidateAnchor = winnerTransform
      ? new Vector3(
          winnerTransform.position[0],
          winnerTransform.position[1] + 0.08,
          winnerTransform.position[2] + 0.08
        )
      : new Vector3(0, 2.2, -2.0);
    const focusAnchor = new Vector3(0, 2.15, -1.15);
    const start = candidateAnchor.clone().lerp(focusAnchor, sceneState.assignTravel * 0.18 + 0.82);
    const end = resolveTargetPosition(sceneState);
    const mid = new Vector3(
      (start.x + end.x) / 2,
      Math.max(start.y, end.y) + 1.55,
      (start.z + end.z) / 2
    );
    const curve = new CatmullRomCurve3([start, mid, end]);
    const visibleProgress = Math.max(0.12, sceneState.assignTravel);
    return curve.getPoints(Math.max(8, Math.round(52 * visibleProgress)));
  }, [sceneState]);
  if (!shouldShow) return null;

  const pulse = 0.72 + Math.sin(sceneState.elapsedMs * 0.01) * 0.14;
  const width = sceneState.phase === "assigning" ? 2.1 : 1.5;

  return (
    <Line
      points={points}
      color="#67e8f9"
      transparent
      opacity={pulse}
      lineWidth={width}
      depthWrite={false}
    />
  );
}
