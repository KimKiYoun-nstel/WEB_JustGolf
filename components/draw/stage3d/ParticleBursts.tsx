import { useMemo } from "react";
import type { StageSceneState } from "./types";

interface ParticleBurstsProps {
  sceneState: StageSceneState;
}

function makeSeededOffsets(count: number) {
  const items: Array<{ x: number; y: number; z: number; size: number }> = [];
  for (let index = 0; index < count; index += 1) {
    const angle = (index / count) * Math.PI * 2;
    const spread = 0.6 + ((index * 13) % 10) / 18;
    items.push({
      x: Math.cos(angle) * spread,
      y: 0.2 + ((index * 17) % 7) / 18,
      z: Math.sin(angle) * spread,
      size: 0.02 + ((index * 19) % 5) / 180,
    });
  }
  return items;
}

export function ParticleBursts({ sceneState }: ParticleBurstsProps) {
  const enabled =
    (sceneState.phase === "picked" || sceneState.phase === "assigning") &&
    sceneState.performanceTier !== "low";

  const points = useMemo(
    () => makeSeededOffsets(sceneState.performanceTier === "high" ? 36 : 20),
    [sceneState.performanceTier]
  );
  if (!enabled) return null;

  const t = sceneState.phase === "assigning" ? sceneState.assignTravel : sceneState.winnerLift;
  const spread = 0.3 + t * 2.1;
  const lift = 0.7 + t * 2.2;

  return (
    <group position={[0, 1.2, 0]}>
      {points.map((point, index) => (
        <mesh
          key={`burst-${index}`}
          position={[point.x * spread, point.y * lift, point.z * spread]}
          scale={1 + t * 0.7}
        >
          <sphereGeometry args={[point.size, 8, 8]} />
          <meshBasicMaterial
            color={sceneState.phase === "assigning" ? "#67e8f9" : "#fde047"}
            transparent
            opacity={Math.max(0, 0.78 - t * 0.5)}
          />
        </mesh>
      ))}
    </group>
  );
}
