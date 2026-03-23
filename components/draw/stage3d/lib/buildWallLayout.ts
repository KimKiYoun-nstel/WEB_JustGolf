export interface WallTransform {
  position: [number, number, number];
  rotationY: number;
}

export interface WallLayout {
  transforms: WallTransform[];
  columns: number;
  rows: number;
  width: number;
  height: number;
  cardWidth: number;
  cardHeight: number;
}

function resolveColumns(candidateCount: number) {
  if (candidateCount <= 12) return 4;
  if (candidateCount <= 24) return 6;
  if (candidateCount <= 40) return 10;
  if (candidateCount <= 60) return 12;
  return 14;
}

export function buildWallLayout(candidateCount: number): WallLayout {
  if (candidateCount <= 0) {
    return {
      transforms: [],
      columns: 0,
      rows: 0,
      width: 0,
      height: 0,
      cardWidth: 0.62,
      cardHeight: 0.34,
    };
  }

  const columns = resolveColumns(candidateCount);
  const rows = Math.ceil(candidateCount / columns);
  const cardWidth = 0.62;
  const cardHeight = 0.34;
  const rowGap = 0.56;
  const topY = 3.12;
  const radius = 4.8 + Math.min(1, rows * 0.08);
  const zCenter = -2.35;
  const angleSpan = Math.min(Math.PI * 0.98, Math.max(Math.PI * 0.72, columns * 0.15));
  const halfSpan = angleSpan / 2;
  const width = radius * angleSpan;
  const height = Math.max(0, (rows - 1) * rowGap) + cardHeight;

  const transforms: WallTransform[] = [];
  for (let index = 0; index < candidateCount; index += 1) {
    const row = Math.floor(index / columns);
    const col = index % columns;
    const t = columns <= 1 ? 0.5 : col / (columns - 1);
    const angle = -halfSpan + angleSpan * t;
    const x = Math.sin(angle) * radius;
    const y = topY - row * rowGap;
    const z = zCenter + (Math.cos(angle) - 1) * radius * 0.86;
    const rotationY = -angle * 0.9;
    transforms.push({
      position: [x, y, z],
      rotationY,
    });
  }

  return {
    transforms,
    columns,
    rows,
    width,
    height,
    cardWidth,
    cardHeight,
  };
}
