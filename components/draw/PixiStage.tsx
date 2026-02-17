"use client";

import { useCallback, useEffect, useRef } from "react";
import type { PixiAnimator } from "../../lib/draw/animators/pixi/types";

type PixiStageProps = {
  animator: PixiAnimator;
  className?: string;
  onError?: (error: unknown) => void;
};

export default function PixiStage({ animator, className, onError }: PixiStageProps) {
  const hostRef = useRef<HTMLDivElement | null>(null);
  const onErrorRef = useRef<typeof onError>(onError);
  const runIdRef = useRef(0);
  const getStageSize = useCallback((host: HTMLDivElement) => {
    const rect = host.getBoundingClientRect();
    const width = Math.max(320, host.clientWidth || rect.width || 0);
    const height = Math.max(220, host.clientHeight || rect.height || 0);
    return { width, height };
  }, []);

  useEffect(() => {
    onErrorRef.current = onError;
  }, [onError]);

  useEffect(() => {
    const host = hostRef.current;
    if (!host) return;
    const runId = runIdRef.current + 1;
    runIdRef.current = runId;
    let disposed = false;
    let raf1 = 0;
    let raf2 = 0;
    let mountTimeout = 0;

    mountTimeout = window.setTimeout(() => {
      if (disposed || runId !== runIdRef.current) return;
      onErrorRef.current?.(new Error("Pixi mount timeout"));
    }, 5000);

    void animator
      .mount(host)
      .then(() => {
        if (mountTimeout) {
          window.clearTimeout(mountTimeout);
          mountTimeout = 0;
        }
        if (disposed || runId !== runIdRef.current) return;
        const resizeNow = () => {
          const size = getStageSize(host);
          animator.resize(size.width, size.height);
        };
        resizeNow();
        raf1 = requestAnimationFrame(() => {
          resizeNow();
          raf2 = requestAnimationFrame(resizeNow);
        });
      })
      .catch((error) => {
        if (mountTimeout) {
          window.clearTimeout(mountTimeout);
          mountTimeout = 0;
        }
        if (runId === runIdRef.current) {
          onErrorRef.current?.(error);
        }
      });

    const observer = new ResizeObserver(() => {
      try {
        const size = getStageSize(host);
        animator.resize(size.width, size.height);
      } catch (error) {
        onErrorRef.current?.(error);
      }
    });
    observer.observe(host);

    return () => {
      disposed = true;
      if (mountTimeout) window.clearTimeout(mountTimeout);
      if (raf1) cancelAnimationFrame(raf1);
      if (raf2) cancelAnimationFrame(raf2);
      observer.disconnect();
      queueMicrotask(() => {
        if (runId !== runIdRef.current) return;
        try {
          animator.destroy();
        } catch (error) {
          onErrorRef.current?.(error);
        }
      });
    };
  }, [animator, getStageSize]);

  return <div ref={hostRef} className={className} />;
}
