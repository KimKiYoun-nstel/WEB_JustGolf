"use client";

import type { AnimatorProps } from "../../lib/draw/animators/Animator";
import LottoAnimator from "./LottoAnimator";
import ScoreboardAnimator from "./scoreboard/ScoreboardAnimator";

export default function DrawAnimator({ kind = "lotto", ...props }: AnimatorProps) {
  if (kind === "scoreboard") {
    return <ScoreboardAnimator {...props} />;
  }

  return <LottoAnimator {...props} />;
}
