export interface RingTransform {
  position: [number, number, number];
  rotationY: number;
}

function resolvePerRing(candidateCount: number) {
  if (candidateCount <= 14) return 14;
  if (candidateCount <= 28) return 16;
  return 20;
}

export function buildRingLayout(candidateCount: number, baseRadius = 4): RingTransform[] {
  if (candidateCount <= 0) return [];

  const perRing = resolvePerRing(candidateCount);
  const out: RingTransform[] = [];
  for (let index = 0; index < candidateCount; index += 1) {
    const ringIndex = Math.floor(index / perRing);
    const laneStart = ringIndex * perRing;
    const laneCount = Math.min(perRing, candidateCount - laneStart);
    const laneIndex = index - laneStart;
    const t = (laneIndex / laneCount) * Math.PI * 2;
    const radius = baseRadius + ringIndex * 1.2;
    const x = Math.cos(t) * radius;
    const z = Math.sin(t) * radius;
    const y = 0.65 + ringIndex * 0.16;
    const rotationY = -t + Math.PI / 2;
    out.push({
      position: [x, y, z],
      rotationY,
    });
  }

  return out;
}
