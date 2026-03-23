import type { StageSceneState } from "./types";
import { CameraRig } from "./CameraRig";
import { StageLighting } from "./StageLighting";
import { EnvironmentFloor } from "./EnvironmentFloor";
import { CandidateWall3D } from "./CandidateWall3D";
import { WinnerFocus } from "./WinnerFocus";
import { GroupPodiums } from "./GroupPodiums";
import { ParticleBursts } from "./ParticleBursts";
import { AssignmentArc } from "./AssignmentArc";

interface StageSceneProps {
  sceneState: StageSceneState;
}

export function StageScene({ sceneState }: StageSceneProps) {
  return (
    <>
      <color attach="background" args={["#04070f"]} />
      <fog attach="fog" args={["#04070f", 10, 22]} />
      <StageLighting sceneState={sceneState} />
      <CameraRig sceneState={sceneState} />
      <EnvironmentFloor sceneState={sceneState} />
      <CandidateWall3D sceneState={sceneState} />
      <GroupPodiums sceneState={sceneState} />
      <AssignmentArc sceneState={sceneState} />
      <WinnerFocus sceneState={sceneState} />
      <ParticleBursts sceneState={sceneState} />
    </>
  );
}
