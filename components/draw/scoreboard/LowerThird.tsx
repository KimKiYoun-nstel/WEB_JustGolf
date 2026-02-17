"use client";

import type { DrawPhase } from "../../../lib/draw/types";
import type { AnimatorCandidate } from "../../../lib/draw/animators/Animator";

interface LowerThirdProps {
  phase: DrawPhase;
  targetGroupNo?: number | null;
  remainingCount: number;
  activeCandidate?: AnimatorCandidate | null;
  winnerCandidate?: AnimatorCandidate | null;
}

function trimLabel(candidate?: AnimatorCandidate | null, maxChars = 20) {
  if (!candidate) return "-";
  return Array.from(candidate.label.trim()).slice(0, maxChars).join("");
}

function resolveStatusText(phase: DrawPhase) {
  if (phase === "configured" || phase === "spinning") return "추첨 연출 진행 중...";
  if (phase === "picked") return "후보 확정, 배정 대기";
  if (phase === "confirmed") return "배정 확정 완료";
  if (phase === "finished") return "모든 배정이 완료되었습니다";
  return "다음 스텝을 준비하세요";
}

function resolveStatusTone(phase: DrawPhase) {
  if (phase === "configured" || phase === "spinning") return "text-sky-700";
  if (phase === "picked") return "text-amber-700";
  if (phase === "confirmed" || phase === "finished") return "text-emerald-700";
  return "text-slate-500";
}

function resolveContainerClass(phase: DrawPhase, hasWinner: boolean) {
  if (hasWinner || phase === "confirmed" || phase === "finished") {
    return "border-emerald-300 bg-gradient-to-r from-emerald-50 via-lime-50 to-emerald-50";
  }
  if (phase === "configured" || phase === "spinning") {
    return "border-sky-300 bg-gradient-to-r from-sky-50 via-cyan-50 to-sky-50";
  }
  if (phase === "picked") {
    return "border-amber-300 bg-gradient-to-r from-amber-50 via-yellow-50 to-amber-50";
  }
  return "border-slate-200 bg-white/95";
}

function resolveBadgeClass(phase: DrawPhase, hasWinner: boolean) {
  if (hasWinner || phase === "confirmed" || phase === "finished") {
    return "border-emerald-400 bg-emerald-100 text-emerald-900";
  }
  if (phase === "configured" || phase === "spinning") {
    return "border-sky-400 bg-sky-100 text-sky-900";
  }
  if (phase === "picked") {
    return "border-amber-400 bg-amber-100 text-amber-900";
  }
  return "border-slate-300 bg-slate-100 text-slate-700";
}

export default function LowerThird({
  phase,
  targetGroupNo,
  remainingCount,
  activeCandidate,
  winnerCandidate,
}: LowerThirdProps) {
  const subject = winnerCandidate ?? activeCandidate ?? null;
  const nameText = trimLabel(subject, winnerCandidate ? 24 : 20);
  const statusText = resolveStatusText(phase);
  const isWinnerVisible = Boolean(winnerCandidate);
  const hideNameOnMobile =
    !isWinnerVisible && (phase === "configured" || phase === "spinning" || phase === "picked");
  const statusToneClass = resolveStatusTone(phase);
  const badgeText =
    isWinnerVisible || phase === "confirmed" || phase === "finished"
      ? "WINNER"
      : phase === "configured" || phase === "spinning"
        ? "LIVE"
        : "READY";

  return (
    <div
      data-testid="draw-scoreboard-lower-third"
      className={`rounded-xl border px-3 py-2 shadow-sm backdrop-blur-[1px] sm:px-4 sm:py-3 ${resolveContainerClass(
        phase,
        isWinnerVisible
      )}`}
    >
      <div className="grid gap-2 sm:grid-cols-[1fr_auto] sm:items-center">
        <div className="min-w-0" data-testid="draw-scoreboard-current-line">
          <p className="mb-1 flex items-center gap-2">
            <span className={`rounded-full border px-2 py-0.5 text-[10px] font-bold ${resolveBadgeClass(phase, isWinnerVisible)}`}>
              {badgeText}
            </span>
            <span className="text-[11px] font-medium text-slate-500">현재 후보</span>
          </p>
          <p className="truncate text-base font-extrabold text-slate-900 sm:text-xl">
            {hideNameOnMobile ? "추첨 중입니다." : nameText}
          </p>
          {isWinnerVisible ? (
            <p className="text-sm font-bold text-emerald-800">당첨: {trimLabel(winnerCandidate, 30)}</p>
          ) : (
            <p className={`text-xs font-semibold ${statusToneClass}`}>{statusText}</p>
          )}
        </div>

        <div className="flex flex-wrap items-center gap-2 text-xs text-slate-600 sm:justify-end">
          <span className="rounded-md border border-slate-300 bg-white/80 px-2 py-1 font-semibold">
            남은 후보 {remainingCount}명
          </span>
          <span className="rounded-md border border-slate-300 bg-white/80 px-2 py-1 font-semibold">
            타겟 조 {targetGroupNo ?? "-"}조
          </span>
        </div>
      </div>
    </div>
  );
}
