import type { StageSceneState } from "./types";

interface StageLightingProps {
  sceneState: StageSceneState;
}

export function StageLighting({ sceneState }: StageLightingProps) {
  const isWinnerMoment = sceneState.phase === "picked" || sceneState.phase === "assigning";
  const isLow = sceneState.performanceTier === "low";

  return (
    <>
      <ambientLight intensity={isLow ? 0.6 : 0.34} color={isLow ? "#e2e8f0" : "#93c5fd"} />
      <hemisphereLight
        intensity={isLow ? 0.22 : 0.35}
        color={isWinnerMoment ? "#d1fae5" : "#bfdbfe"}
        groundColor="#020617"
      />
      <directionalLight
        position={[5, 8, 4]}
        intensity={isLow ? 0.42 : 0.74}
        color={isWinnerMoment ? "#fef08a" : "#a5b4fc"}
      />
      {!isLow && (
        <>
          <spotLight
            position={[0, 10, 2]}
            intensity={isWinnerMoment ? 1.2 : 0.76}
            angle={0.34}
            penumbra={0.45}
            color={isWinnerMoment ? "#fef9c3" : "#bae6fd"}
          />
          <pointLight
            position={[0, 1.8, 0]}
            intensity={isWinnerMoment ? 1.05 : 0.58}
            color={isWinnerMoment ? "#6ee7b7" : "#60a5fa"}
            distance={10}
            decay={2.1}
          />
        </>
      )}
    </>
  );
}
