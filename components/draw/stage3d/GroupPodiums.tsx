import type { StageSceneState } from "./types";

interface GroupPodiumsProps {
  sceneState: StageSceneState;
}

function resolveGroupCount(sceneState: StageSceneState) {
  const knownMax = Math.max(sceneState.targetGroupNo ?? 0, sceneState.assignGroupNo ?? 0);
  return Math.max(4, knownMax);
}

function groupPosition(groupNo: number, total: number): [number, number, number] {
  const radius = 7.3;
  const angle = ((groupNo - 1) / total) * Math.PI * 2;
  return [Math.cos(angle) * radius, 0.28, Math.sin(angle) * radius];
}

export function GroupPodiums({ sceneState }: GroupPodiumsProps) {
  const shouldShow = sceneState.phase === "assigning" || sceneState.phase === "finished";
  if (!shouldShow) return null;

  const groupCount = resolveGroupCount(sceneState);
  const focusGroupNo = sceneState.assignGroupNo ?? sceneState.targetGroupNo ?? null;
  const focusPulse = 0.75 + Math.sin(sceneState.elapsedMs * 0.008) * 0.18;

  return (
    <group>
      {Array.from({ length: groupCount }, (_, index) => index + 1).map((groupNo) => {
        const [x, y, z] = groupPosition(groupNo, groupCount);
        const isFocus = focusGroupNo === groupNo;
        return (
          <group key={groupNo} position={[x, y, z]}>
            <mesh>
              <cylinderGeometry args={[0.36, 0.54, isFocus ? 0.72 : 0.5, 20]} />
              <meshStandardMaterial
                color={isFocus ? "#22d3ee" : "#64748b"}
                emissive={isFocus ? "#0e7490" : "#111827"}
                emissiveIntensity={isFocus ? 0.65 : 0.16}
                metalness={0.35}
                roughness={0.38}
              />
            </mesh>
            {isFocus ? (
              <>
                <mesh rotation={[Math.PI / 2, 0, 0]} position={[0, 0.42, 0]}>
                  <torusGeometry args={[0.62, 0.036, 12, 48]} />
                  <meshBasicMaterial color="#67e8f9" transparent opacity={focusPulse} />
                </mesh>
                <mesh position={[0, 0.37, 0]}>
                  <sphereGeometry args={[0.11, 12, 12]} />
                  <meshStandardMaterial color="#cffafe" emissive="#22d3ee" emissiveIntensity={0.5} />
                </mesh>
              </>
            ) : null}
          </group>
        );
      })}
    </group>
  );
}
