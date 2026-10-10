import type { Vec3 } from "../vec";

/** An axis-aligned bounding box. Empty input gives lo = +∞, hi = −∞. */
export interface Bounds {
  lo: Vec3;
  hi: Vec3;
}

/** bounds of xyz triples packed in a flat array */
export function boundsOfFlat(pos: ArrayLike<number>): Bounds {
  const lo: Vec3 = [Infinity, Infinity, Infinity];
  const hi: Vec3 = [-Infinity, -Infinity, -Infinity];
  for (let i = 0; i + 2 < pos.length; i += 3) {
    for (let k = 0; k < 3; k++) {
      lo[k] = Math.min(lo[k], pos[i + k]);
      hi[k] = Math.max(hi[k], pos[i + k]);
    }
  }
  return { lo, hi };
}

export const boundsOf = (points: Vec3[]): Bounds => boundsOfFlat(points.flat());

export const diagonalOf = (b: Bounds): number => Math.hypot(b.hi[0] - b.lo[0], b.hi[1] - b.lo[1], b.hi[2] - b.lo[2]);

/** do the boxes overlap (touching counts)? */
export const boundsOverlap = (a: Bounds, b: Bounds): boolean =>
  [0, 1, 2].every((k) => a.lo[k] <= b.hi[k] && a.hi[k] >= b.lo[k]);

export const unionBounds = (a: Bounds, b: Bounds): Bounds => ({
  lo: [Math.min(a.lo[0], b.lo[0]), Math.min(a.lo[1], b.lo[1]), Math.min(a.lo[2], b.lo[2])],
  hi: [Math.max(a.hi[0], b.hi[0]), Math.max(a.hi[1], b.hi[1]), Math.max(a.hi[2], b.hi[2])],
});
