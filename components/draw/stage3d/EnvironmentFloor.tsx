import type { StageSceneState } from "./types";

interface EnvironmentFloorProps {
  sceneState: StageSceneState;
}

export function EnvironmentFloor({ sceneState }: EnvironmentFloorProps) {
  const winnerMoment = sceneState.phase === "picked" || sceneState.phase === "assigning";
  const tint = winnerMoment ? "#0e3a34" : "#111a2d";

  return (
    <group>
      <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, 0, 0]}>
        <circleGeometry args={[8.8, 96]} />
        <meshStandardMaterial color={tint} roughness={0.2} metalness={0.56} />
      </mesh>
      <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, 0.02, 0]}>
        <ringGeometry args={[3.75, 4.04, 72]} />
        <meshStandardMaterial color="#a78bfa" emissive="#7c3aed" emissiveIntensity={0.26} />
      </mesh>
      <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, 0.025, 0]}>
        <ringGeometry args={[5.0, 5.14, 96]} />
        <meshBasicMaterial
          color={winnerMoment ? "#34d399" : "#22d3ee"}
          transparent
          opacity={winnerMoment ? 0.56 : 0.3}
        />
      </mesh>
      <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, 0.03, 0]}>
        <ringGeometry args={[6.2, 6.33, 104]} />
        <meshBasicMaterial color="#818cf8" transparent opacity={0.28} />
      </mesh>
      <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, 0.016, 0]}>
        <ringGeometry args={[7.1, 7.2, 112]} />
        <meshBasicMaterial color="#67e8f9" transparent opacity={winnerMoment ? 0.24 : 0.14} />
      </mesh>
      <mesh position={[0, 4.2, -8.5]}>
        <planeGeometry args={[20, 10]} />
        <meshBasicMaterial color="#0b1024" transparent opacity={0.56} />
      </mesh>
    </group>
  );
}
