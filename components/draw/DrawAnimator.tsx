"use client";

import dynamic from "next/dynamic";
import type { AnimatorProps } from "../../lib/draw/animators/Animator";
import LottoAnimator from "./LottoAnimator";
import ScoreboardAnimator from "./scoreboard/ScoreboardAnimator";

const Stage3DAnimator = dynamic(
  () => import("./stage3d/Stage3DAnimator").then((module) => module.Stage3DAnimator),
  { ssr: false }
);

export default function DrawAnimator({ kind = "lotto", ...props }: AnimatorProps) {
  if (kind === "stage3d") {
    return <Stage3DAnimator {...props} />;
  }

  if (kind === "scoreboard") {
    return <ScoreboardAnimator {...props} />;
  }

  return <LottoAnimator {...props} />;
}
