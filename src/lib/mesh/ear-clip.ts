/** Ear clipping of a simple 2D polygon. Triangles come back as index triples wound like the polygon. */
export type Point2 = [number, number];

export function signedArea(pts: Point2[]): number {
  let s = 0;
  for (let k = 0; k < pts.length; k++) {
    const a = pts[k];
    const b = pts[(k + 1) % pts.length];
    s += a[0] * b[1] - a[1] * b[0];
  }
  return s / 2;
}

const cross2 = (o: Point2, a: Point2, b: Point2): number =>
  (a[0] - o[0]) * (b[1] - o[1]) - (a[1] - o[1]) * (b[0] - o[0]);

function insideTriangle(p: Point2, a: Point2, b: Point2, c: Point2): boolean {
  return cross2(a, b, p) >= 0 && cross2(b, c, p) >= 0 && cross2(c, a, p) >= 0;
}

function isEar(pts: Point2[], ring: number[], i: number): boolean {
  const a = pts[ring[(i + ring.length - 1) % ring.length]];
  const b = pts[ring[i]];
  const c = pts[ring[(i + 1) % ring.length]];
  if (cross2(a, b, c) <= 0) return false;
  for (let k = 0; k < ring.length; k++) {
    const p = pts[ring[k]];
    if (p === a || p === b || p === c) continue;
    if (insideTriangle(p, a, b, c)) return false;
  }
  return true;
}

function findEar(pts: Point2[], ring: number[]): number {
  for (let i = 0; i < ring.length; i++) if (isEar(pts, ring, i)) return i;
  // degenerate input (collinear runs, self-touching): take any non-reflex corner, else the first
  for (let i = 0; i < ring.length; i++) {
    const a = pts[ring[(i + ring.length - 1) % ring.length]];
    const c = pts[ring[(i + 1) % ring.length]];
    if (cross2(a, pts[ring[i]], c) >= 0) return i;
  }
  return 0;
}

function clipCounterClockwise(pts: Point2[], ring: number[]): number[][] {
  const out: number[][] = [];
  while (ring.length > 3) {
    const i = findEar(pts, ring);
    const n = ring.length;
    out.push([ring[(i + n - 1) % n], ring[i], ring[(i + 1) % n]]);
    ring.splice(i, 1);
  }
  out.push([ring[0], ring[1], ring[2]]);
  return out;
}

export function earClip(pts: Point2[]): number[][] {
  if (pts.length < 3) return [];
  const ring = pts.map((_, i) => i);
  if (signedArea(pts) >= 0) return clipCounterClockwise(pts, ring);
  return clipCounterClockwise(pts, ring.reverse()).map((t) => t.reverse());
}
