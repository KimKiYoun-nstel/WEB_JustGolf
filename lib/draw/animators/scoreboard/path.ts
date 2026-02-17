export interface ScoreboardTempo {
  baseHz: number;
  slowdownMs: number;
  nearMiss: number;
}

export interface ScoreboardScanPathOptions {
  candidateCount: number;
  durationMs: number;
  seed: number;
  tempo?: Partial<ScoreboardTempo> | null;
}

export interface ScoreboardScanPath {
  path: number[];
  timelineMs: number[];
  tickMs: number;
  durationMs: number;
  seed: number;
  tempo: ScoreboardTempo;
  startIndex: number;
}

export interface ScoreboardRevealPathOptions {
  candidateCount: number;
  startIndex: number;
  winnerIndex: number;
  seed: number;
  tempo?: Partial<ScoreboardTempo> | null;
  revealDurationMs?: number;
}

const DEFAULT_TEMPO: ScoreboardTempo = {
  baseHz: 10,
  slowdownMs: 3200,
  nearMiss: 0,
};

function clamp(value: number, min: number, max: number) {
  return Math.max(min, Math.min(max, value));
}

function toFiniteInt(value: unknown, fallback: number) {
  if (typeof value !== "number" || !Number.isFinite(value)) return fallback;
  return Math.trunc(value);
}

function wrapIndex(index: number, length: number) {
  if (length <= 0) return 0;
  return ((index % length) + length) % length;
}

function easeOutCubic(value: number) {
  const x = clamp(value, 0, 1);
  return 1 - Math.pow(1 - x, 3);
}

export function normalizeScoreboardTempo(input?: Partial<ScoreboardTempo> | null): ScoreboardTempo {
  return {
    baseHz: clamp(toFiniteInt(input?.baseHz, DEFAULT_TEMPO.baseHz), 4, 24),
    slowdownMs: clamp(toFiniteInt(input?.slowdownMs, DEFAULT_TEMPO.slowdownMs), 900, 12000),
    nearMiss: clamp(toFiniteInt(input?.nearMiss, DEFAULT_TEMPO.nearMiss), 0, 1),
  };
}

function normalizeSeed(seed: number) {
  const base = Number.isFinite(seed) ? Math.trunc(seed) : 0;
  return base >>> 0;
}

export function deriveDrawSeed(parts: Array<string | number | null | undefined>) {
  let hash = 2166136261;
  for (const part of parts) {
    const text = String(part ?? "");
    for (let i = 0; i < text.length; i += 1) {
      hash ^= text.charCodeAt(i);
      hash = Math.imul(hash, 16777619);
    }
  }
  return hash >>> 0;
}

function resolveIntervals(params: {
  durationMs: number;
  tempo: ScoreboardTempo;
}) {
  const { durationMs, tempo } = params;
  const baseTick = clamp(Math.round(1000 / Math.max(1, tempo.baseHz)), 70, 260);
  const slowTick = clamp(baseTick * 3, baseTick + 90, 740);
  const slowdownMs = clamp(tempo.slowdownMs, 700, durationMs);
  const slowdownStartMs = Math.max(0, durationMs - slowdownMs);
  return { baseTick, slowTick, slowdownStartMs };
}

function resolveStepIntervalMs(params: {
  elapsedMs: number;
  durationMs: number;
  tempo: ScoreboardTempo;
}) {
  const { elapsedMs, durationMs, tempo } = params;
  const { baseTick, slowTick, slowdownStartMs } = resolveIntervals({ durationMs, tempo });
  if (elapsedMs <= slowdownStartMs) return baseTick;

  const slowdownProgress = clamp(
    (elapsedMs - slowdownStartMs) / Math.max(1, durationMs - slowdownStartMs),
    0,
    1
  );
  const eased = easeOutCubic(slowdownProgress);
  return Math.round(baseTick + (slowTick - baseTick) * eased);
}

export function buildScoreboardScanPath(options: ScoreboardScanPathOptions): ScoreboardScanPath {
  const candidateCount = Math.max(1, Math.trunc(options.candidateCount));
  const durationMs = clamp(Math.trunc(options.durationMs), 800, 60000);
  const tempo = normalizeScoreboardTempo(options.tempo);
  const seed = normalizeSeed(options.seed);
  const startIndex = candidateCount > 0 ? seed % candidateCount : 0;
  const path: number[] = [startIndex];
  const timelineMs: number[] = [0];
  const tickMs = clamp(Math.round(1000 / tempo.baseHz), 20, 120);

  let elapsedMs = 0;
  let cursor = startIndex;
  let safety = 0;

  while (elapsedMs < durationMs && safety < 4000) {
    safety += 1;
    const stepIntervalMs = resolveStepIntervalMs({
      elapsedMs,
      durationMs,
      tempo,
    });
    const nextElapsed = elapsedMs + stepIntervalMs;
    if (nextElapsed > durationMs) break;
    elapsedMs = nextElapsed;
    cursor = wrapIndex(cursor + 1, candidateCount);
    path.push(cursor);
    timelineMs.push(elapsedMs);
  }

  if (timelineMs[timelineMs.length - 1] < durationMs) {
    timelineMs.push(durationMs);
    path.push(cursor);
  }

  return {
    path,
    timelineMs,
    tickMs,
    durationMs,
    seed,
    tempo,
    startIndex,
  };
}

export function resolveScoreboardScanIndexAtElapsed(
  scanPath: ScoreboardScanPath,
  elapsedMs: number
) {
  const elapsed = clamp(elapsedMs, 0, scanPath.durationMs);
  const timeline = scanPath.timelineMs;
  const path = scanPath.path;
  if (timeline.length === 0 || path.length === 0) return 0;

  let lo = 0;
  let hi = timeline.length - 1;
  while (lo < hi) {
    const mid = Math.ceil((lo + hi) / 2);
    if (timeline[mid] <= elapsed) {
      lo = mid;
    } else {
      hi = mid - 1;
    }
  }

  return path[Math.min(lo, path.length - 1)] ?? 0;
}

export function resolveScoreboardCursorIndex(options: {
  candidateCount: number;
  durationMs: number;
  seed: number;
  tempo?: Partial<ScoreboardTempo> | null;
  startedAtMs: number;
  atMs: number;
}) {
  const scanPath = buildScoreboardScanPath({
    candidateCount: options.candidateCount,
    durationMs: options.durationMs,
    seed: options.seed,
    tempo: options.tempo,
  });
  const elapsedMs = options.atMs - options.startedAtMs;
  return resolveScoreboardScanIndexAtElapsed(scanPath, elapsedMs);
}

export function buildScoreboardRevealPath(options: ScoreboardRevealPathOptions) {
  const candidateCount = Math.max(1, Math.trunc(options.candidateCount));
  const winnerIndex = wrapIndex(options.winnerIndex, candidateCount);
  const startIndex = wrapIndex(options.startIndex, candidateCount);
  const tempo = normalizeScoreboardTempo(options.tempo);
  const revealDurationMs = clamp(
    Math.trunc(options.revealDurationMs ?? 1200),
    400,
    2500
  );
  const forwardDistance = wrapIndex(winnerIndex - startIndex, candidateCount);
  if (forwardDistance === 0) {
    return [winnerIndex, winnerIndex];
  }

  const stepCount = Math.max(1, forwardDistance);
  const path: number[] = [startIndex];
  const minInterval = Math.max(14, Math.floor(revealDurationMs / (stepCount * 1.8)));
  const maxInterval = Math.max(minInterval + 8, Math.floor(revealDurationMs / Math.max(1, stepCount)));
  let elapsed = 0;

  for (let step = 1; step <= stepCount; step += 1) {
    const progress = step / stepCount;
    const interval = Math.round(minInterval + (maxInterval - minInterval) * easeOutCubic(progress));
    elapsed += interval;
    if (elapsed > revealDurationMs && step > 1) break;
    path.push(wrapIndex(startIndex + step, candidateCount));
  }

  while (path.length < Math.max(4, Math.ceil((revealDurationMs / 1000) * tempo.baseHz * 0.35))) {
    path.push(winnerIndex);
  }

  if (path[path.length - 1] !== winnerIndex) {
    path.push(winnerIndex);
  }
  path.push(winnerIndex);
  return path;
}

export const SCOREBOARD_DEFAULT_TEMPO = DEFAULT_TEMPO;
