import { useEffect, useMemo } from "react";
import { CanvasTexture, SRGBColorSpace } from "three";
import type { StageCandidateVisual, StagePhase } from "./types";

interface CandidateCard3DProps {
  candidate: StageCandidateVisual;
  position: [number, number, number];
  rotationY: number;
  phase: StagePhase;
}

export function CandidateCard3D({
  candidate,
  position,
  rotationY,
  phase,
}: CandidateCard3DProps) {
  const isWinner = candidate.isWinner;
  const isActive = candidate.isActive;
  const isNearMiss = candidate.isNearMiss;
  const inWinnerPhase = phase === "picked" || phase === "assigning" || phase === "finished";
  const hiddenByWinnerFocus = inWinnerPhase && isWinner;
  const lift = isActive ? 0.14 : isNearMiss ? 0.06 : 0;
  const scale = hiddenByWinnerFocus ? 0.08 : isWinner ? 1.24 : isActive ? 1.2 : isNearMiss ? 1.08 : 1;
  const color = isWinner ? "#f8fafc" : isActive ? "#fde68a" : isNearMiss ? "#dbeafe" : "#93c5fd";
  const emissive = isWinner ? "#4ade80" : isActive ? "#f59e0b" : isNearMiss ? "#22d3ee" : "#1d4ed8";
  const emissiveIntensity = hiddenByWinnerFocus
    ? 0
    : isWinner
      ? 0.84
      : isActive
        ? 0.56
        : isNearMiss
          ? 0.32
          : 0.1;
  const alpha = hiddenByWinnerFocus ? 0.03 : inWinnerPhase && !isWinner ? 0.24 : 0.95;
  const labelTexture = useMemo(() => {
    const canvas = document.createElement("canvas");
    canvas.width = 160;
    canvas.height = 72;
    const context = canvas.getContext("2d");
    if (!context) return null;

    context.clearRect(0, 0, canvas.width, canvas.height);
    context.fillStyle = isWinner
      ? "rgba(16, 185, 129, 0.95)"
      : isActive
        ? "rgba(245, 158, 11, 0.95)"
        : "rgba(15, 23, 42, 0.88)";
    context.fillRect(0, 0, canvas.width, canvas.height);

    context.strokeStyle = "rgba(255,255,255,0.32)";
    context.lineWidth = 3;
    context.strokeRect(1.5, 1.5, canvas.width - 3, canvas.height - 3);

    context.fillStyle = "#f8fafc";
    context.font = "600 30px sans-serif";
    context.textAlign = "center";
    context.textBaseline = "middle";
    context.fillText(`#${candidate.slotNo ?? candidate.index + 1}`, canvas.width / 2, canvas.height / 2);

    const texture = new CanvasTexture(canvas);
    texture.colorSpace = SRGBColorSpace;
    return texture;
  }, [candidate.index, candidate.slotNo, isActive, isWinner]);

  useEffect(() => {
    return () => {
      labelTexture?.dispose();
    };
  }, [labelTexture]);

  return (
    <group
      position={[position[0], position[1] + lift, position[2]]}
      rotation={[0, rotationY, 0]}
      scale={scale}
    >
      <mesh>
        <sphereGeometry args={[0.14, 14, 14]} />
        <meshStandardMaterial
          color={color}
          emissive={emissive}
          emissiveIntensity={emissiveIntensity}
          roughness={0.22}
          metalness={0.36}
          transparent
          opacity={alpha}
        />
      </mesh>
      <mesh rotation={[Math.PI / 2, 0, 0]} position={[0, -0.11, 0]}>
        <torusGeometry args={[0.22, 0.014, 12, 40]} />
        <meshBasicMaterial
          color={isWinner ? "#4ade80" : isActive ? "#facc15" : "#60a5fa"}
          transparent
          opacity={hiddenByWinnerFocus ? 0.05 : isActive || isWinner ? 0.9 : isNearMiss ? 0.55 : 0.28}
        />
      </mesh>
      {labelTexture ? (
        <sprite position={[0, 0.2, 0]} scale={[0.34, 0.15, 1]}>
          <spriteMaterial map={labelTexture} transparent opacity={hiddenByWinnerFocus ? 0.05 : alpha} />
        </sprite>
      ) : null}
    </group>
  );
}
