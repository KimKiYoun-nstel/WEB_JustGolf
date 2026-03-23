import type { StageSceneState } from "./types";

interface SelectionGateProps {
  sceneState: StageSceneState;
}

function resolveGateRadius(sceneState: StageSceneState) {
  return sceneState.presentationMode === "admin" ? 4 : 4.3;
}

export function SelectionGate({ sceneState }: SelectionGateProps) {
  const radius = resolveGateRadius(sceneState);
  const pulse =
    sceneState.phase === "spinning"
      ? 0.68 + Math.sin(sceneState.elapsedMs * 0.02) * 0.2
      : sceneState.phase === "picked"
        ? 0.9
        : 0.54;

  return (
    <group position={[radius, 0.3, 0]} rotation={[0, -Math.PI / 2, 0]}>
      <mesh position={[0, 0.44, 0]}>
        <boxGeometry args={[0.62, 0.08, 0.24]} />
        <meshStandardMaterial
          color="#22d3ee"
          emissive="#0891b2"
          emissiveIntensity={pulse}
          roughness={0.22}
          metalness={0.54}
        />
      </mesh>
      <mesh position={[0, 0.29, 0]} rotation={[Math.PI / 2, 0, 0]}>
        <coneGeometry args={[0.1, 0.24, 3]} />
        <meshBasicMaterial color="#67e8f9" transparent opacity={Math.min(1, pulse)} />
      </mesh>
      <mesh rotation={[-Math.PI / 2, 0, Math.PI / 2]} position={[radius - 0.35, 0.02, 0]}>
        <planeGeometry args={[0.16, radius * 2 - 0.7]} />
        <meshBasicMaterial color="#38bdf8" transparent opacity={0.16 + pulse * 0.08} />
      </mesh>
    </group>
  );
}
