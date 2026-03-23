"use client";

import { useEffect, useRef, useState } from "react";
import { Canvas } from "@react-three/fiber";
import type { StageSceneState } from "./types";
import { StageScene } from "./StageScene";

interface StageCanvasProps {
  sceneState: StageSceneState;
}

function resolveDpr(tier: StageSceneState["performanceTier"]) {
  if (tier === "low") return [1, 1] as [number, number];
  if (tier === "medium") return [1, 1.1] as [number, number];
  return [1, 1.2] as [number, number];
}

export function StageCanvas({ sceneState }: StageCanvasProps) {
  const [contextLost, setContextLost] = useState(false);
  const cleanupListenersRef = useRef<(() => void) | null>(null);
  const canvasTokenRef = useRef(0);

  useEffect(() => {
    return () => {
      cleanupListenersRef.current?.();
      cleanupListenersRef.current = null;
    };
  }, []);

  return (
    <div className="absolute inset-0">
      {contextLost ? (
        <div className="absolute inset-0 z-10 flex items-center justify-center bg-[#04070f]">
          <div className="rounded-xl border border-slate-500/40 bg-slate-900/80 px-4 py-3 text-center text-sm text-slate-200">
            Recovering 3D renderer...
          </div>
        </div>
      ) : null}
      <Canvas
        dpr={resolveDpr(sceneState.performanceTier)}
        shadows={false}
        gl={{
          antialias: sceneState.performanceTier !== "low",
          powerPreference: "default",
          alpha: false,
          stencil: false,
        }}
        camera={{ position: [0, 4.8, 10.2], fov: 46 }}
        onCreated={({ gl }) => {
          cleanupListenersRef.current?.();
          setContextLost(false);
          gl.setClearColor("#04070f", 1);

          const canvas = gl.domElement;
          const token = canvasTokenRef.current + 1;
          canvasTokenRef.current = token;

          const handleContextLost = (event: Event) => {
            event.preventDefault();
            if (canvasTokenRef.current !== token) return;
            setContextLost(true);
          };
          const handleContextRestored = () => {
            if (canvasTokenRef.current !== token) return;
            setContextLost(false);
          };

          canvas.addEventListener("webglcontextlost", handleContextLost, false);
          canvas.addEventListener("webglcontextrestored", handleContextRestored, false);
          cleanupListenersRef.current = () => {
            canvas.removeEventListener("webglcontextlost", handleContextLost, false);
            canvas.removeEventListener("webglcontextrestored", handleContextRestored, false);
          };
        }}
      >
        <StageScene sceneState={sceneState} />
      </Canvas>
    </div>
  );
}
