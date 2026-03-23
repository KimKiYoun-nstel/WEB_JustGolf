import { useFrame, useThree } from "@react-three/fiber";
import { useMemo } from "react";
import { Vector3 } from "three";
import type { StageSceneState } from "./types";

interface CameraRigProps {
  sceneState: StageSceneState;
}

function resolveAssignLookAt(sceneState: StageSceneState) {
  const groupNo = sceneState.assignGroupNo ?? sceneState.targetGroupNo ?? 1;
  const total = Math.max(4, Math.max(sceneState.assignGroupNo ?? 0, sceneState.targetGroupNo ?? 0));
  const angle = ((groupNo - 1) / total) * Math.PI * 2;
  const radius = 7.3;
  return new Vector3(Math.cos(angle) * radius, 1.35, Math.sin(angle) * radius);
}

function resolveCameraTarget(sceneState: StageSceneState) {
  if (sceneState.presentationMode === "admin") {
    return {
      position: new Vector3(0, 4.5, 8.2),
      lookAt: new Vector3(0, 2.3, -2.25),
    };
  }

  switch (sceneState.phase) {
    case "configured":
      return {
        position: new Vector3(0, 4.25, 7.95),
        lookAt: new Vector3(0, 2.26, -2.2),
      };
    case "spinning":
      return {
        position: new Vector3(0, 4.05, 7.45),
        lookAt: new Vector3(0, 2.24, -2.18),
      };
    case "picked":
      return {
        position: new Vector3(0, 3.78, 6.75),
        lookAt: new Vector3(0, 2.2, -1.88),
      };
    case "assigning":
      return {
        position: new Vector3(0, 4.2, 7.6),
        lookAt: new Vector3(0, 2.14, -1.95),
      };
    case "finished":
      return {
        position: new Vector3(0, 4.6, 8.5),
        lookAt: new Vector3(0, 2.15, -2.05),
      };
    case "idle":
    default:
      return {
        position: new Vector3(0, 4.45, 8.35),
        lookAt: new Vector3(0, 2.2, -2.2),
      };
  }
}

export function CameraRig({ sceneState }: CameraRigProps) {
  const { camera } = useThree();
  const target = useMemo(() => resolveCameraTarget(sceneState), [sceneState]);
  const assignLookAt = useMemo(() => resolveAssignLookAt(sceneState), [sceneState]);
  const lookTarget = useMemo(() => new Vector3(), []);
  const dynamicLookTarget = useMemo(() => new Vector3(), []);
  const desiredPosition = useMemo(() => new Vector3(), []);
  const cameraLerp = sceneState.performanceTier === "low" ? 0.06 : 0.1;
  const phaseElapsedSec = sceneState.elapsedMs / 1000;

  useFrame(() => {
    const orbitStrength =
      sceneState.presentationMode === "admin"
        ? 0.05
        : sceneState.phase === "spinning"
          ? 0.12
          : sceneState.phase === "picked"
            ? 0.06
            : sceneState.phase === "assigning"
              ? 0.1
              : 0.04;
    const bobStrength = sceneState.presentationMode === "admin" ? 0.01 : 0.04;
    const orbitX = Math.sin(phaseElapsedSec * 0.52) * orbitStrength;
    const orbitZ = Math.cos(phaseElapsedSec * 0.52) * orbitStrength;
    const bobY = Math.sin(phaseElapsedSec * 1.4) * bobStrength;

    desiredPosition.set(
      target.position.x + orbitX,
      target.position.y + bobY,
      target.position.z + orbitZ
    );
    dynamicLookTarget.copy(target.lookAt);
    if (sceneState.phase === "assigning" || sceneState.phase === "finished") {
      const assignT = sceneState.phase === "assigning" ? sceneState.assignTravel : 1;
      dynamicLookTarget.lerp(assignLookAt, Math.min(1, assignT * 0.72));
    }
    camera.position.lerp(desiredPosition, cameraLerp);
    lookTarget.lerp(dynamicLookTarget, cameraLerp * 0.9);
    camera.lookAt(lookTarget);
  });

  return null;
}
