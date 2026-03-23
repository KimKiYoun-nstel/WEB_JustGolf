import { Line, Text } from "@react-three/drei";
import { useMemo } from "react";
import { Vector3 } from "three";
import type { StageSceneState } from "./types";
import { buildWallLayout } from "./lib/buildWallLayout";

interface CandidateWall3DProps {
  sceneState: StageSceneState;
}

function truncateLabel(label: string, maxChars: number) {
  const chars = Array.from(label.trim());
  if (chars.length <= maxChars) return chars.join("");
  return `${chars.slice(0, maxChars - 3).join("")}...`;
}

function uniqueIndexes(values: number[]) {
  return Array.from(new Set(values));
}

export function CandidateWall3D({ sceneState }: CandidateWall3DProps) {
  const layout = useMemo(
    () => buildWallLayout(sceneState.candidates.length),
    [sceneState.candidates.length]
  );
  const winnerMoment =
    sceneState.phase === "picked" ||
    sceneState.phase === "assigning" ||
    sceneState.phase === "finished";
  const activeTransform =
    sceneState.activeIndex !== null ? layout.transforms[sceneState.activeIndex] : null;

  const scanTracePoints = useMemo(() => {
    if (sceneState.activeIndex === null) return [] as Vector3[];
    const indexes = uniqueIndexes([...sceneState.nearMissIndexes, sceneState.activeIndex]).filter(
      (index) => index >= 0 && index < layout.transforms.length
    );
    return indexes.map((index) => {
      const transform = layout.transforms[index];
      return new Vector3(
        transform.position[0],
        transform.position[1] + 0.34,
        transform.position[2] + 0.06
      );
    });
  }, [layout.transforms, sceneState.activeIndex, sceneState.nearMissIndexes]);

  const wallHeight = Math.max(2.6, layout.height + 0.95);
  const wallWidth = Math.max(5.8, layout.width + 1.8);

  return (
    <group>
      <mesh position={[0, 2.06, -5.72]}>
        <planeGeometry args={[wallWidth, wallHeight]} />
        <meshStandardMaterial
          color="#0a1020"
          emissive={winnerMoment ? "#083a2e" : "#13213d"}
          emissiveIntensity={winnerMoment ? 0.22 : 0.12}
          roughness={0.68}
          metalness={0.3}
        />
      </mesh>
      <mesh position={[0, 3.52, -5.68]}>
        <planeGeometry args={[wallWidth * 0.94, 0.14]} />
        <meshBasicMaterial color="#38bdf8" transparent opacity={0.2} />
      </mesh>
      {sceneState.candidates.map((candidate, index) => {
        const transform = layout.transforms[index];
        if (!transform) return null;

        const isWinner = candidate.isWinner;
        const isActive = candidate.isActive;
        const isNearMiss = candidate.isNearMiss;
        const color = isWinner
          ? "#065f46"
          : isActive
            ? "#1d4ed8"
            : isNearMiss
              ? "#0f766e"
              : "#0f172a";
        const faceColor = isWinner
          ? "#34d399"
          : isActive
            ? "#60a5fa"
            : isNearMiss
              ? "#67e8f9"
              : "#1e293b";
        const emissive = isWinner ? "#10b981" : isActive ? "#3b82f6" : "#0f172a";
        const emissiveIntensity = isWinner ? 0.8 : isActive ? 0.66 : isNearMiss ? 0.28 : 0.06;
        const opacity = winnerMoment && !isWinner ? 0.25 : 0.98;
        const scale = isWinner ? 1.12 : isActive ? 1.07 : 1;
        const depth = 0.056;

        return (
          <group
            key={candidate.id}
            position={transform.position}
            rotation={[0, transform.rotationY, 0]}
            scale={scale}
          >
            <mesh>
              <boxGeometry args={[layout.cardWidth, layout.cardHeight, depth]} />
              <meshStandardMaterial
                color={color}
                emissive={emissive}
                emissiveIntensity={emissiveIntensity}
                roughness={0.34}
                metalness={0.46}
                transparent
                opacity={opacity}
              />
            </mesh>
            <mesh position={[0, 0, depth / 2 + 0.003]}>
              <planeGeometry args={[layout.cardWidth * 0.9, layout.cardHeight * 0.82]} />
              <meshStandardMaterial
                color={faceColor}
                emissive={isWinner ? "#34d399" : isActive ? "#60a5fa" : "#0f172a"}
                emissiveIntensity={isWinner ? 0.34 : isActive ? 0.24 : 0.04}
                roughness={0.6}
                metalness={0.16}
                transparent
                opacity={opacity}
              />
            </mesh>
            <Text
              position={[0, 0.086, depth / 2 + 0.012]}
              maxWidth={layout.cardWidth * 0.82}
              fontSize={0.072}
              anchorX="center"
              anchorY="middle"
              color="#e2e8f0"
            >
              {`#${candidate.slotNo ?? candidate.index + 1}`}
            </Text>
            <Text
              position={[0, -0.076, depth / 2 + 0.012]}
              maxWidth={layout.cardWidth * 0.82}
              fontSize={0.06}
              anchorX="center"
              anchorY="middle"
              color={isWinner || isActive ? "#f8fafc" : "#cbd5e1"}
            >
              {truncateLabel(candidate.label, 13)}
            </Text>
          </group>
        );
      })}
      {scanTracePoints.length >= 2 ? (
        <Line
          points={scanTracePoints}
          color="#67e8f9"
          transparent
          opacity={0.48}
          lineWidth={1.3}
          depthWrite={false}
        />
      ) : null}
      {activeTransform ? (
        <group
          position={[
            activeTransform.position[0],
            activeTransform.position[1] + 0.44,
            activeTransform.position[2] + 0.06,
          ]}
          rotation={[0, activeTransform.rotationY, 0]}
        >
          <mesh position={[0, 0.12, 0]}>
            <sphereGeometry args={[0.06, 14, 14]} />
            <meshStandardMaterial color="#fef08a" emissive="#f59e0b" emissiveIntensity={0.72} />
          </mesh>
          <mesh position={[0, -0.12, 0]}>
            <cylinderGeometry args={[0.022, 0.022, 0.34, 10]} />
            <meshBasicMaterial color="#fde047" transparent opacity={0.64} />
          </mesh>
          <mesh rotation={[Math.PI / 2, 0, 0]} position={[0, -0.28, 0]}>
            <ringGeometry args={[layout.cardWidth * 0.48, layout.cardWidth * 0.57, 42]} />
            <meshBasicMaterial color="#fef08a" transparent opacity={0.74} />
          </mesh>
        </group>
      ) : null}
    </group>
  );
}
