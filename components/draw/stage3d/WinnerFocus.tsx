import type { StageSceneState } from "./types";
import { buildWallLayout } from "./lib/buildWallLayout";

interface WinnerFocusProps {
  sceneState: StageSceneState;
}

function resolveGroupCount(sceneState: StageSceneState) {
  const knownMax = Math.max(sceneState.targetGroupNo ?? 0, sceneState.assignGroupNo ?? 0);
  return Math.max(4, knownMax);
}

function resolvePodiumPosition(sceneState: StageSceneState): [number, number, number] {
  const groupNo = sceneState.assignGroupNo ?? sceneState.targetGroupNo ?? 1;
  const total = resolveGroupCount(sceneState);
  const angle = ((groupNo - 1) / total) * Math.PI * 2;
  const radius = 7.3;
  return [Math.cos(angle) * radius, 1.45, Math.sin(angle) * radius];
}

export function WinnerFocus({ sceneState }: WinnerFocusProps) {
  const shouldShow =
    sceneState.phase === "picked" ||
    sceneState.phase === "assigning" ||
    sceneState.phase === "finished";
  if (!shouldShow || !sceneState.winner) return null;

  const wallLayout = buildWallLayout(sceneState.candidates.length);
  const winnerIndex = sceneState.candidates.findIndex(
    (candidate) => candidate.id === sceneState.winner?.id
  );
  const winnerTransform = winnerIndex >= 0 ? wallLayout.transforms[winnerIndex] : null;

  const candidateAnchor: [number, number, number] = winnerTransform
    ? [
        winnerTransform.position[0],
        winnerTransform.position[1] + 0.06,
        winnerTransform.position[2] + 0.08,
      ]
    : [0, 2.2, -2.0];
  const focusAnchor: [number, number, number] = [0, 2.15, -1.15];
  const revealT = sceneState.phase === "picked" ? sceneState.winnerLift : 1;
  const revealPosition: [number, number, number] = [
    candidateAnchor[0] + (focusAnchor[0] - candidateAnchor[0]) * revealT,
    candidateAnchor[1] + (focusAnchor[1] - candidateAnchor[1]) * revealT,
    candidateAnchor[2] + (focusAnchor[2] - candidateAnchor[2]) * revealT,
  ];

  const end = resolvePodiumPosition(sceneState);
  const assignT =
    sceneState.phase === "assigning" ? sceneState.assignTravel : sceneState.phase === "finished" ? 1 : 0;
  const position: [number, number, number] = [
    revealPosition[0] + (end[0] - revealPosition[0]) * assignT,
    revealPosition[1] + (end[1] - revealPosition[1]) * assignT,
    revealPosition[2] + (end[2] - revealPosition[2]) * assignT,
  ];
  const scale = sceneState.phase === "picked" ? 1.1 : 1;
  const trailOpacity = sceneState.phase === "assigning" ? 0.52 : 0.26;

  return (
    <group position={position} scale={scale}>
      <mesh position={[0, 0.16, 0]}>
        <sphereGeometry args={[0.22, 20, 20]} />
        <meshStandardMaterial
          color="#f8fafc"
          emissive="#22c55e"
          emissiveIntensity={0.48}
          roughness={0.11}
          metalness={0.2}
        />
      </mesh>
      <mesh position={[0, -0.02, 0]}>
        <cylinderGeometry args={[0.19, 0.24, 0.08, 18]} />
        <meshStandardMaterial color="#14532d" emissive="#16a34a" emissiveIntensity={0.38} />
      </mesh>
      <mesh rotation={[Math.PI / 2, 0, 0]} position={[0, -0.03, 0]}>
        <torusGeometry args={[0.42, 0.03, 12, 56]} />
        <meshBasicMaterial color="#4ade80" transparent opacity={0.76} />
      </mesh>
      <mesh position={[0, 0.22, 0]}>
        <sphereGeometry args={[0.3, 12, 12]} />
        <meshBasicMaterial color="#86efac" transparent opacity={trailOpacity} />
      </mesh>
    </group>
  );
}
