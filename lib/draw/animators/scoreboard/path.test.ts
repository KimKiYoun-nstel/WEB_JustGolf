import { describe, expect, it } from "vitest";
import {
  buildScoreboardRevealPath,
  buildScoreboardScanPath,
  deriveDrawSeed,
  normalizeScoreboardTempo,
  resolveScoreboardCursorIndex,
  resolveScoreboardScanIndexAtElapsed,
} from "./path";

describe("scoreboard path", () => {
  it("normalizes tempo bounds", () => {
    const tempo = normalizeScoreboardTempo({
      baseHz: 999,
      slowdownMs: 10,
      nearMiss: -3,
    });

    expect(tempo.baseHz).toBe(24);
    expect(tempo.slowdownMs).toBe(900);
    expect(tempo.nearMiss).toBe(0);
  });

  it("creates deterministic scan path from the same seed", () => {
    const seed = deriveDrawSeed(["step", 12, "abc"]);
    const a = buildScoreboardScanPath({
      candidateCount: 40,
      durationMs: 3600,
      seed,
      tempo: { baseHz: 18, slowdownMs: 2000, nearMiss: 3 },
    });
    const b = buildScoreboardScanPath({
      candidateCount: 40,
      durationMs: 3600,
      seed,
      tempo: { baseHz: 18, slowdownMs: 2000, nearMiss: 3 },
    });

    expect(a.path).toEqual(b.path);
    expect(a.timelineMs).toEqual(b.timelineMs);
    expect(a.path.length).toBeGreaterThan(20);
    expect(a.path.every((index) => index >= 0 && index < 40)).toBe(true);
    expect(
      a.timelineMs.every((value, index) => index === 0 || value >= a.timelineMs[index - 1])
    ).toBe(true);
  });

  it("advances cursor in one direction and resolves deterministic index at time", () => {
    const seed = deriveDrawSeed(["cursor", "demo"]);
    const scan = buildScoreboardScanPath({
      candidateCount: 17,
      durationMs: 4200,
      seed,
      tempo: { baseHz: 10, slowdownMs: 2400, nearMiss: 0 },
    });
    const first = resolveScoreboardScanIndexAtElapsed(scan, 0);
    const mid = resolveScoreboardScanIndexAtElapsed(scan, 1800);
    const end = resolveScoreboardScanIndexAtElapsed(scan, 5000);

    expect(first).toBe(scan.startIndex);
    expect(mid).not.toBe(first);
    expect(end).toBe(scan.path[scan.path.length - 1]);

    const startedAtMs = 1_730_000_000_000;
    const serverIndex = resolveScoreboardCursorIndex({
      candidateCount: 17,
      durationMs: 4200,
      seed,
      tempo: { baseHz: 10, slowdownMs: 2400, nearMiss: 0 },
      startedAtMs,
      atMs: startedAtMs + 1800,
    });
    expect(serverIndex).toBe(mid);
  });

  it("creates reveal path that converges to winner index without near-miss", () => {
    const path = buildScoreboardRevealPath({
      candidateCount: 17,
      startIndex: 3,
      winnerIndex: 11,
      seed: deriveDrawSeed(["reveal", 1]),
      tempo: { nearMiss: 0, baseHz: 10, slowdownMs: 1400 },
      revealDurationMs: 1200,
    });

    expect(path.length).toBeGreaterThanOrEqual(4);
    expect(path[path.length - 1]).toBe(11);
    expect(path.some((index) => index !== 11)).toBe(true);
    for (let i = 1; i < path.length; i += 1) {
      const prev = path[i - 1];
      const current = path[i];
      if (current === prev) continue;
      expect(current).toBe((prev + 1) % 17);
    }
  });
});
