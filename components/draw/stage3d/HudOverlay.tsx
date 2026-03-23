import { AnimatePresence, motion } from "framer-motion";
import type { StageSceneState } from "./types";
import { LowerThird } from "./LowerThird";
import { StatusBadgeBar } from "./StatusBadgeBar";

interface HudOverlayProps {
  sceneState: StageSceneState;
}

function shouldShowWinnerBanner(sceneState: StageSceneState) {
  if (sceneState.presentationMode === "admin") return false;
  return (
    Boolean(sceneState.hud.winnerName) &&
    (sceneState.phase === "picked" ||
      sceneState.phase === "assigning" ||
      sceneState.phase === "finished")
  );
}

export function HudOverlay({ sceneState }: HudOverlayProps) {
  return (
    <div className="absolute inset-0">
      <StatusBadgeBar sceneState={sceneState} />
      <AnimatePresence>
        {shouldShowWinnerBanner(sceneState) ? (
          <motion.div
            key="winner-banner"
            initial={{ opacity: 0, y: -18, scale: 0.98 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: -12, scale: 0.98 }}
            transition={{ duration: 0.28, ease: "easeOut" }}
            className="pointer-events-none absolute left-1/2 top-7 z-20 w-[min(92%,560px)] -translate-x-1/2"
          >
            <div className="rounded-xl border border-emerald-300/35 bg-gradient-to-r from-emerald-900/32 via-teal-900/28 to-cyan-900/28 px-4 py-2 text-center backdrop-blur-sm">
              <p className="text-[11px] font-semibold uppercase tracking-[0.14em] text-emerald-200">
                당첨 후보 확정
              </p>
              <p className="truncate text-lg font-semibold text-emerald-100">
                {sceneState.hud.winnerName}
                {sceneState.assignGroupNo ? ` · ${sceneState.assignGroupNo}조` : ""}
              </p>
            </div>
          </motion.div>
        ) : null}
      </AnimatePresence>
      <LowerThird sceneState={sceneState} />
    </div>
  );
}
