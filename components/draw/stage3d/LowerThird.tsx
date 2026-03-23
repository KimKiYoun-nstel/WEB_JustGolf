import { motion } from "framer-motion";
import type { StageSceneState } from "./types";

interface LowerThirdProps {
  sceneState: StageSceneState;
}

export function LowerThird({ sceneState }: LowerThirdProps) {
  const progressPercent = Math.round(sceneState.progress * 100);

  return (
    <motion.div
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.24, ease: "easeOut" }}
      className="pointer-events-none absolute bottom-3 left-3 right-3 z-20 rounded-xl border border-slate-200/20 bg-slate-950/62 px-3 py-2.5 backdrop-blur-sm"
    >
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div className="min-w-0">
          <p className="truncate text-sm font-semibold text-slate-100">{sceneState.hud.title}</p>
          <p className="truncate text-xs text-slate-300">{sceneState.hud.subtitle}</p>
        </div>
        <div className="flex items-center gap-2 text-xs">
          <span className="rounded-full border border-slate-300/40 bg-slate-900/70 px-2 py-0.5 text-slate-100">
            {sceneState.hud.statusText}
          </span>
          <span className="rounded-full border border-slate-300/40 bg-slate-900/70 px-2 py-0.5 text-slate-100">
            진행률 {progressPercent}%
          </span>
        </div>
      </div>
      <div className="mt-2 h-1.5 overflow-hidden rounded-full bg-slate-700/65">
        <motion.div
          className="h-full rounded-full bg-gradient-to-r from-cyan-400 via-emerald-300 to-amber-300 transition-[width] duration-150"
          animate={{ width: `${Math.max(4, progressPercent)}%` }}
          transition={{ duration: 0.16, ease: "easeOut" }}
        />
      </div>
      {sceneState.hud.winnerName ? (
        <p className="mt-2 truncate text-sm font-semibold text-emerald-300">
          당첨 후보: {sceneState.hud.winnerName}
          {sceneState.assignGroupNo ? ` → ${sceneState.assignGroupNo}조` : ""}
        </p>
      ) : sceneState.hud.activeName ? (
        <p className="mt-2 truncate text-sm font-semibold text-cyan-300">
          스캔 후보: {sceneState.hud.activeName}
        </p>
      ) : null}
    </motion.div>
  );
}
