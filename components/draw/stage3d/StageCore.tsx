import { useFrame } from "@react-three/fiber";
import { useRef } from "react";
import type { Group } from "three";
import type { StageSceneState } from "./types";

interface StageCoreProps {
  sceneState: StageSceneState;
}

function resolveSpinVelocity(sceneState: StageSceneState) {
  if (sceneState.phase === "spinning") return 1.9;
  if (sceneState.phase === "picked") return 0.65;
  if (sceneState.phase === "assigning") return 1.1;
  return 0.42;
}

export function StageCore({ sceneState }: StageCoreProps) {
  const drumBandRef = useRef<Group>(null);
  const centerRotorRef = useRef<Group>(null);

  useFrame((_, delta) => {
    const drumBand = drumBandRef.current;
    if (drumBand) {
      drumBand.rotation.y += delta * resolveSpinVelocity(sceneState);
    }

    const centerRotor = centerRotorRef.current;
    if (centerRotor) {
      centerRotor.rotation.y -= delta * (resolveSpinVelocity(sceneState) * 0.7);
    }
  });

  const isHighlight = sceneState.phase === "picked" || sceneState.phase === "assigning";
  const glow = isHighlight ? "#4ade80" : "#38bdf8";

  return (
    <group position={[0, 0.22, 0]}>
      <mesh>
        <cylinderGeometry args={[2.6, 2.95, 0.44, 52]} />
        <meshStandardMaterial
          color="#0f172a"
          emissive="#0b1220"
          emissiveIntensity={0.28}
          roughness={0.35}
          metalness={0.62}
        />
      </mesh>
      <mesh position={[0, 0.3, 0]}>
        <cylinderGeometry args={[3.02, 3.24, 0.6, 72, 1, true]} />
        <meshStandardMaterial
          color="#1e293b"
          emissive="#0f172a"
          emissiveIntensity={0.12}
          roughness={0.22}
          metalness={0.72}
          transparent
          opacity={0.88}
        />
      </mesh>
      <group ref={drumBandRef} position={[0, 0.44, 0]}>
        <mesh rotation={[Math.PI / 2, 0, 0]} position={[0, 0, 0]}>
          <torusGeometry args={[3.08, 0.05, 14, 92]} />
          <meshBasicMaterial color={glow} transparent opacity={0.66} />
        </mesh>
        {Array.from({ length: 18 }, (_, idx) => {
          const angle = (idx / 18) * Math.PI * 2;
          const x = Math.cos(angle) * 2.98;
          const z = Math.sin(angle) * 2.98;
          return (
            <mesh key={`drum-tick-${idx}`} position={[x, 0, z]} rotation={[0, -angle, 0]}>
              <boxGeometry args={[0.07, 0.08, 0.24]} />
              <meshStandardMaterial color="#93c5fd" emissive="#1d4ed8" emissiveIntensity={0.24} />
            </mesh>
          );
        })}
      </group>
      <group ref={centerRotorRef} position={[0, 0.48, 0]}>
        <mesh rotation={[Math.PI / 2, 0, 0]}>
          <torusGeometry args={[1.22, 0.05, 12, 66]} />
          <meshBasicMaterial color="#a78bfa" transparent opacity={0.58} />
        </mesh>
        {Array.from({ length: 6 }, (_, idx) => {
          const angle = (idx / 6) * Math.PI * 2;
          const x = Math.cos(angle) * 1.03;
          const z = Math.sin(angle) * 1.03;
          return (
            <mesh key={`center-fin-${idx}`} position={[x, 0, z]} rotation={[0, -angle, 0]}>
              <boxGeometry args={[0.1, 0.08, 0.34]} />
              <meshStandardMaterial
                color="#dbeafe"
                emissive="#38bdf8"
                emissiveIntensity={0.26}
                roughness={0.3}
                metalness={0.44}
              />
            </mesh>
          );
        })}
      </group>
    </group>
  );
}
