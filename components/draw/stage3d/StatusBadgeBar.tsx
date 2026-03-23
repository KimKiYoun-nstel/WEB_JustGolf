import type { StageSceneState } from "./types";

interface StatusBadgeBarProps {
  sceneState: StageSceneState;
}

function badgeClass(accent: "cyan" | "amber" | "emerald" | "slate") {
  if (accent === "cyan") return "border-cyan-300/70 bg-cyan-500/15 text-cyan-100";
  if (accent === "amber") return "border-amber-300/70 bg-amber-500/15 text-amber-100";
  if (accent === "emerald") return "border-emerald-300/70 bg-emerald-500/15 text-emerald-100";
  return "border-slate-300/40 bg-slate-700/40 text-slate-100";
}

export function StatusBadgeBar({ sceneState }: StatusBadgeBarProps) {
  const accent =
    sceneState.phase === "picked" || sceneState.phase === "assigning"
      ? "amber"
      : sceneState.phase === "finished"
        ? "emerald"
        : "cyan";

  return (
    <div className="pointer-events-none absolute left-3 top-3 z-20 flex flex-wrap items-center gap-2 text-xs">
      <span className={`rounded-full border px-2 py-0.5 font-semibold ${badgeClass("emerald")}`}>
        LIVE
      </span>
      <span className={`rounded-full border px-2 py-0.5 font-semibold ${badgeClass(accent)}`}>
        {sceneState.phase.toUpperCase()}
      </span>
      <span className={`rounded-full border px-2 py-0.5 font-semibold ${badgeClass("slate")}`}>
        {sceneState.hud.stepText}
      </span>
      {sceneState.targetGroupNo ? (
        <span className={`rounded-full border px-2 py-0.5 font-semibold ${badgeClass("slate")}`}>
          타겟 {sceneState.targetGroupNo}조
        </span>
      ) : null}
      {sceneState.presentationMode === "admin" ? (
        <span className={`rounded-full border px-2 py-0.5 font-semibold ${badgeClass("slate")}`}>
          PREVIEW
        </span>
      ) : null}
      {sceneState.performanceTier !== "high" ? (
        <span className={`rounded-full border px-2 py-0.5 font-semibold ${badgeClass("slate")}`}>
          {sceneState.performanceTier.toUpperCase()}
        </span>
      ) : null}
    </div>
  );
}
