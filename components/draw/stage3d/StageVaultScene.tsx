"use client";

import { Fragment } from "react";
import type { CSSProperties } from "react";
import type { StageCandidateVisual, StageSceneState } from "./types";

interface WallSlotLayout {
  left: number;
  top: number;
  row: number;
  col: number;
  curve: number;
}

interface Point {
  left: number;
  top: number;
}

function clamp(value: number, min: number, max: number) {
  return Math.max(min, Math.min(max, value));
}

function lerp(start: number, end: number, progress: number) {
  return start + (end - start) * progress;
}

function easeOutCubic(value: number) {
  return 1 - Math.pow(1 - value, 3);
}

function truncateLabel(label: string, maxChars: number) {
  const chars = Array.from(label.trim());
  if (chars.length <= maxChars) return chars.join("");
  return `${chars.slice(0, maxChars - 1).join("")}…`;
}

function resolveColumns(candidateCount: number, mode: StageSceneState["presentationMode"]) {
  if (mode === "admin") {
    if (candidateCount <= 16) return 4;
    if (candidateCount <= 28) return 5;
    return 6;
  }

  if (candidateCount <= 14) return 4;
  if (candidateCount <= 24) return 5;
  return 6;
}

function buildWallLayout(sceneState: StageSceneState) {
  const columns = resolveColumns(sceneState.candidates.length, sceneState.presentationMode);
  const rows = Math.max(1, Math.ceil(sceneState.candidates.length / columns));

  return {
    columns,
    rows,
    slots: sceneState.candidates.map((_, index) => {
      const row = Math.floor(index / columns);
      const col = index % columns;
      const colProgress = columns <= 1 ? 0.5 : col / (columns - 1);
      const rowProgress = rows <= 1 ? 0 : row / (rows - 1);

      return {
        left: 15 + colProgress * 56,
        top: 24 + rowProgress * 50,
        row,
        col,
        curve: (colProgress - 0.5) * 1.1,
      } satisfies WallSlotLayout;
    }),
  };
}

function resolveTone(candidate: StageCandidateVisual) {
  if (candidate.isWinner) return "winner" as const;
  if (candidate.isActive) return "active" as const;
  if (candidate.isNearMiss) return "near" as const;
  return "idle" as const;
}

function resolveCardFrameClass(tone: ReturnType<typeof resolveTone>, elevated: boolean) {
  if (tone === "winner") {
    return "border-emerald-300/90 bg-[linear-gradient(165deg,rgba(5,46,22,0.98),rgba(16,185,129,0.88))] text-emerald-50 shadow-[0_18px_44px_rgba(16,185,129,0.2)]";
  }
  if (tone === "active") {
    return [
      "border-cyan-300/90 text-cyan-50",
      elevated
        ? "bg-[linear-gradient(165deg,rgba(9,41,74,0.98),rgba(34,211,238,0.86))] shadow-[0_20px_48px_rgba(34,211,238,0.2)]"
        : "bg-[linear-gradient(165deg,rgba(9,41,74,0.94),rgba(14,116,144,0.62))] shadow-[0_14px_28px_rgba(34,211,238,0.14)]",
    ].join(" ");
  }
  if (tone === "near") {
    return "border-sky-300/60 bg-[linear-gradient(165deg,rgba(15,23,42,0.95),rgba(29,78,216,0.58))] text-sky-50 shadow-[0_10px_22px_rgba(96,165,250,0.12)]";
  }
  return "border-slate-700/90 bg-[linear-gradient(165deg,rgba(15,23,42,0.95),rgba(10,16,28,0.9))] text-slate-100";
}

function renderCardShell(params: {
  candidate: StageCandidateVisual;
  tone: ReturnType<typeof resolveTone>;
  style: CSSProperties;
  variant: "wall" | "focus" | "dock";
  caption: string;
  subcaption?: string;
}) {
  const { candidate, tone, style, variant, caption, subcaption } = params;
  const elevated = variant !== "wall" || tone === "active" || tone === "winner";
  const slotNo = candidate.slotNo ?? candidate.index + 1;
  const label = truncateLabel(candidate.label, variant === "wall" ? 14 : 24);

  return (
    <div
      className={`absolute [transform-style:preserve-3d] transition-[left,top,transform,opacity] duration-150 ${
        variant === "dock" ? "h-[76px] w-[180px]" : variant === "focus" ? "h-[118px] w-[280px]" : "h-[74px] w-[148px]"
      }`}
      style={style}
      data-candidate-id={candidate.id}
      data-tone={tone}
      data-variant={variant}
    >
      <div className="absolute left-[10px] right-[10px] top-[-8px] h-[12px] skew-x-[-38deg] rounded-t-xl bg-white/12" />
      <div className="absolute bottom-[8px] right-[-8px] top-[8px] w-[12px] skew-y-[-38deg] rounded-r-xl bg-black/26" />
      <div className={`relative h-full w-full overflow-hidden rounded-2xl border ${resolveCardFrameClass(tone, elevated)}`}>
        <div className="absolute inset-x-0 top-0 h-12 bg-gradient-to-b from-white/14 to-transparent" />
        <div className="relative flex h-full flex-col justify-between px-3 py-2.5">
          <div className="flex items-center justify-between text-[10px] font-semibold uppercase tracking-[0.18em] text-white/72">
            <span>{caption}</span>
            <span>{slotNo}</span>
          </div>
          <div>
            <p className={`${variant === "wall" ? "text-[16px]" : "text-[24px]"} font-semibold leading-tight`}>
              {label}
            </p>
            {subcaption ? (
              <p className="mt-1 text-[11px] uppercase tracking-[0.16em] text-white/62">{subcaption}</p>
            ) : null}
          </div>
        </div>
      </div>
    </div>
  );
}

function renderBeam(source: Point, target: Point, accent: "cyan" | "emerald") {
  const dx = target.left - source.left;
  const dy = (target.top - source.top) * 0.72;
  const angle = (Math.atan2(dy, dx) * 180) / Math.PI;
  const length = Math.sqrt(dx * dx + dy * dy);
  const gradient =
    accent === "emerald"
      ? "from-emerald-300/0 via-emerald-300/60 to-emerald-300/0"
      : "from-cyan-300/0 via-cyan-300/60 to-cyan-300/0";

  return (
    <div
      className={`absolute z-20 h-[3px] origin-left rounded-full bg-gradient-to-r ${gradient}`}
      style={{
        left: `${source.left}%`,
        top: `${source.top}%`,
        width: `${length}%`,
        transform: `translateY(-50%) rotate(${angle}deg)`,
      }}
    />
  );
}

function renderGrid(sceneState: StageSceneState, layouts: WallSlotLayout[]) {
  return sceneState.candidates.map((candidate, index) => {
    const layout = layouts[index];
    const tone = resolveTone(candidate);
    const hideWinnerInWall =
      candidate.isWinner &&
      (sceneState.phase === "picked" || sceneState.phase === "assigning" || sceneState.phase === "finished");
    const dimmed =
      (sceneState.phase === "picked" || sceneState.phase === "assigning" || sceneState.phase === "finished") &&
      !candidate.isWinner;
    const activeLift = candidate.isActive && (sceneState.phase === "configured" || sceneState.phase === "spinning");
    const nearLift = candidate.isNearMiss && sceneState.phase === "spinning";

    const style = {
      left: `${layout.left}%`,
      top: `${layout.top}%`,
      opacity: hideWinnerInWall ? 0.05 : dimmed ? 0.16 : 1,
      zIndex: activeLift ? 30 : nearLift ? 22 : 10 - layout.row,
      transform:
        `translate3d(-50%, -50%, ${activeLift ? 92 : nearLift ? 46 : -layout.row * 12}px) ` +
        `rotateX(${activeLift ? 6 : 18}deg) rotateY(${layout.curve * -16}deg) ` +
        `scale(${activeLift ? 1.1 : nearLift ? 1.04 : 1})`,
    } satisfies CSSProperties;

    return (
      <Fragment key={candidate.id}>
        {renderCardShell({
          candidate,
          tone,
          style,
          variant: "wall",
          caption: "후보",
          subcaption:
            tone === "winner"
              ? "locked"
              : tone === "active"
                ? "scan"
                : tone === "near"
                  ? "near miss"
                  : undefined,
        })}
      </Fragment>
    );
  });
}

function getActivePoint(layout: WallSlotLayout) {
  return { left: layout.left, top: layout.top } satisfies Point;
}

function getWinnerFocusPoint() {
  return { left: 50, top: 34 } satisfies Point;
}

function getDockPoint(sceneState: StageSceneState) {
  const targetGroupNo = sceneState.assignGroupNo ?? sceneState.targetGroupNo ?? 1;
  const columns = 2;
  const row = Math.floor((targetGroupNo - 1) / columns);
  const col = (targetGroupNo - 1) % columns;

  return {
    left: 84 + col * 8,
    top: 31 + row * 12,
  } satisfies Point;
}

function renderScanGuides(sceneState: StageSceneState, activeLayout: WallSlotLayout | null) {
  if (!activeLayout || (sceneState.phase !== "configured" && sceneState.phase !== "spinning")) {
    return null;
  }

  const source = { left: 10, top: 18 } satisfies Point;
  const active = getActivePoint(activeLayout);

  return (
    <>
      <div className="absolute left-[8.5%] top-[15.5%] z-20 h-[18px] w-[18px] rounded-full border border-cyan-300/70 bg-cyan-300/20 shadow-[0_0_24px_rgba(34,211,238,0.22)]" />
      {renderBeam(source, active, "cyan")}
      <div
        className="absolute left-[11%] right-[23%] z-10 h-[54px] rounded-[20px] border border-cyan-300/12 bg-[linear-gradient(90deg,rgba(34,211,238,0.04),rgba(34,211,238,0.12),rgba(34,211,238,0.04))]"
        style={{ top: `${active.top - 5.8}%` }}
      />
      <div
        className="absolute z-20 h-[124px] w-[124px] -translate-x-1/2 -translate-y-1/2 rounded-full border border-cyan-300/18 bg-[radial-gradient(circle,rgba(34,211,238,0.14),rgba(34,211,238,0)_72%)]"
        style={{ left: `${active.left}%`, top: `${active.top}%` }}
      />
    </>
  );
}

function renderWinnerCard(sceneState: StageSceneState, winnerCandidate: StageCandidateVisual, winnerLayout: WallSlotLayout) {
  const source = getActivePoint(winnerLayout);
  const focus = getWinnerFocusPoint();
  const dock = getDockPoint(sceneState);
  const pickedProgress = sceneState.phase === "picked" ? easeOutCubic(sceneState.winnerLift) : 1;
  const assignProgress =
    sceneState.phase === "assigning"
      ? easeOutCubic(sceneState.assignTravel)
      : sceneState.phase === "finished"
        ? 1
        : 0;

  const focusPoint = {
    left: lerp(source.left, focus.left, pickedProgress),
    top: lerp(source.top, focus.top, pickedProgress),
  } satisfies Point;

  const endPoint = {
    left: lerp(focusPoint.left, dock.left, assignProgress),
    top: lerp(focusPoint.top, dock.top, assignProgress),
  } satisfies Point;

  return (
    <>
      {sceneState.phase === "picked" ? renderBeam(source, focusPoint, "emerald") : null}
      {(sceneState.phase === "assigning" || sceneState.phase === "finished")
        ? renderBeam(focus, endPoint, "emerald")
        : null}
      <div className="absolute left-1/2 top-[21%] z-20 h-[138px] w-[138px] -translate-x-1/2 rounded-full border border-emerald-300/14 bg-[radial-gradient(circle,rgba(16,185,129,0.18),rgba(16,185,129,0)_72%)]" />
      {renderCardShell({
        candidate: winnerCandidate,
        tone: "winner",
        variant: sceneState.phase === "finished" ? "dock" : "focus",
        caption: sceneState.phase === "finished" ? "배정" : "당첨",
        subcaption: `${sceneState.assignGroupNo ?? sceneState.targetGroupNo ?? 1}조`,
        style: {
          left: `${endPoint.left}%`,
          top: `${endPoint.top}%`,
          zIndex: 40,
          transform:
            `translate3d(-50%, -50%, ${sceneState.phase === "finished" ? 120 : 200}px) ` +
            `rotateX(${sceneState.phase === "finished" ? 14 : 8}deg) ` +
            `rotateY(${sceneState.phase === "finished" ? -10 : 0}deg) ` +
            `scale(${sceneState.phase === "finished" ? 0.76 : 1.04})`,
        },
      })}
    </>
  );
}

function renderGroupDock(sceneState: StageSceneState) {
  const groupCount = Math.max(4, sceneState.assignGroupNo ?? 0, sceneState.targetGroupNo ?? 0);
  const targetGroupNo = sceneState.assignGroupNo ?? sceneState.targetGroupNo ?? null;

  return (
    <div className="absolute right-5 top-[17%] z-10 w-[22%] min-w-[220px] rounded-[28px] border border-white/8 bg-[linear-gradient(180deg,rgba(8,15,28,0.86),rgba(4,8,18,0.72))] p-4 shadow-[inset_0_1px_0_rgba(255,255,255,0.04)]">
      <div className="flex items-center justify-between text-[11px] uppercase tracking-[0.24em] text-slate-300">
        <span>조 도크</span>
        <span>{`${groupCount} bays`}</span>
      </div>
      <div className="mt-4 grid grid-cols-2 gap-3">
        {Array.from({ length: groupCount }, (_, index) => index + 1).map((groupNo) => {
          const isTarget = groupNo === targetGroupNo;
          return (
            <div
              key={groupNo}
              className={`rounded-2xl border px-3 py-3 ${
                isTarget
                  ? "border-amber-300/80 bg-[linear-gradient(160deg,rgba(120,53,15,0.72),rgba(251,191,36,0.18))] text-amber-50"
                  : "border-slate-700/90 bg-slate-900/86 text-slate-300"
              }`}
            >
              <div className="text-[10px] font-semibold uppercase tracking-[0.18em] text-white/60">GROUP</div>
              <div className="mt-1 text-2xl font-semibold leading-none">{groupNo}</div>
              <div className="mt-2 h-2 rounded-full bg-white/8">
                <div className={`h-full rounded-full ${isTarget ? "bg-amber-300/80" : "bg-slate-600/80"}`} />
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

export function StageVaultScene({ sceneState }: { sceneState: StageSceneState }) {
  const { columns, rows, slots } = buildWallLayout(sceneState);
  const activeLayout = sceneState.activeIndex !== null ? slots[sceneState.activeIndex] : null;
  const winnerCandidate = sceneState.winner
    ? sceneState.candidates.find((candidate) => candidate.id === sceneState.winner?.id) ?? null
    : null;
  const winnerLayout = winnerCandidate ? slots[winnerCandidate.index] : null;

  return (
    <div className="absolute inset-0 overflow-hidden rounded-2xl bg-[radial-gradient(circle_at_top,rgba(14,78,109,0.22),transparent_28%),linear-gradient(180deg,#030712_0%,#07111f_50%,#020617_100%)]">
      <div className="absolute inset-0 [perspective:1800px]">
        <div className="absolute inset-x-5 top-12 bottom-20 rounded-[34px] border border-white/8 bg-[linear-gradient(180deg,rgba(6,14,28,0.86),rgba(4,8,18,0.68))] shadow-[inset_0_1px_0_rgba(255,255,255,0.05)]">
          <div className="absolute inset-x-8 top-6 flex items-center justify-between text-[11px] uppercase tracking-[0.22em] text-slate-400">
            <span>{`후보 스캔 월 ${columns} x ${rows}`}</span>
            <span>{`전체 후보 ${sceneState.candidates.length}명`}</span>
          </div>
          <div className="absolute left-[8%] top-[14%] z-0 h-[68%] w-[68%] rounded-[34px] border border-white/8 bg-[linear-gradient(180deg,rgba(12,21,37,0.82),rgba(8,15,28,0.58))] shadow-[inset_0_1px_0_rgba(255,255,255,0.04)]" />
          <div className="absolute left-[10%] right-[24%] bottom-[17%] z-0 h-[12px] rounded-full border border-cyan-300/10 bg-[linear-gradient(90deg,rgba(34,211,238,0.02),rgba(34,211,238,0.12),rgba(34,211,238,0.02))]" />
          <div className="absolute left-[9.5%] top-[18%] text-[11px] uppercase tracking-[0.24em] text-slate-500">
            후보 보드
          </div>
          {renderScanGuides(sceneState, activeLayout)}
          {renderGrid(sceneState, slots)}
          {winnerCandidate && winnerLayout && (sceneState.phase === "picked" || sceneState.phase === "assigning" || sceneState.phase === "finished")
            ? renderWinnerCard(sceneState, winnerCandidate, winnerLayout)
            : null}
        </div>
        {renderGroupDock(sceneState)}`r`n      </div>
    </div>
  );
}






