"use client";

import { useEffect, useState } from "react";
import type { StagePerformanceTier } from "../types";

function resolveTier(lowSpecMode: boolean, width: number) {
  if (lowSpecMode) return "low" as StagePerformanceTier;
  if (width < 640) return "medium" as StagePerformanceTier;
  return "high" as StagePerformanceTier;
}

export function usePerformanceTier(lowSpecMode: boolean | undefined): StagePerformanceTier {
  const [tier, setTier] = useState<StagePerformanceTier>(() => {
    if (typeof window === "undefined") return lowSpecMode ? "low" : "high";
    return resolveTier(Boolean(lowSpecMode), window.innerWidth);
  });

  useEffect(() => {
    const update = () => {
      setTier(resolveTier(Boolean(lowSpecMode), window.innerWidth));
    };
    update();
    window.addEventListener("resize", update);
    return () => window.removeEventListener("resize", update);
  }, [lowSpecMode]);

  return tier;
}

