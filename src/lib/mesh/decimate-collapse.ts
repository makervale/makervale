import { QUADRIC_SIZE, optimalPoint, quadricError } from "./decimate-quadric";
import type { Soup } from "./decimate-soup";
import { crossOf } from "./decimate-soup";

/** a surrounding triangle may not turn further than this (cos) during a collapse */
const MIN_DOT = 0.2;

export type Point = [number, number, number];

export interface Collapse {
  cost: number;
  a: number;
  b: number;
  /** the vertices' versions when this was computed */
  va: number;
  vb: number;
  /** where the merged vertex goes */
  p: Point;
}

const scratch = new Float64Array(QUADRIC_SIZE);
const at = (s: Soup, v: number): Point => [s.pos[v * 3], s.pos[v * 3 + 1], s.pos[v * 3 + 2]];
const dist2 = (p: Point, q: Point): number => (p[0] - q[0]) ** 2 + (p[1] - q[1]) ** 2 + (p[2] - q[2]) ** 2;

/** best of the two ends and the midpoint */
function bestSimplePoint(q: Float64Array, pa: Point, pb: Point): { cost: number; p: Point } {
  const mid: Point = [(pa[0] + pb[0]) / 2, (pa[1] + pb[1]) / 2, (pa[2] + pb[2]) / 2];
  let best = { cost: quadricError(q, ...pa), p: pa };
  for (const p of [pb, mid]) {
    const cost = quadricError(q, ...p);
    if (cost < best.cost) best = { cost, p };
  }
  return best;
}

/** where a and b should merge and what it costs: the quadric optimum if it stays near the edge */
export function planCollapse(s: Soup, a: number, b: number): Collapse {
  const q = s.quadrics.sum(a, b, scratch);
  const plan = (cost: number, p: Point): Collapse => ({
    cost: Math.max(0, cost),
    a,
    b,
    va: s.version[a],
    vb: s.version[b],
    p,
  });
  if (s.locked[a] || s.locked[b]) {
    const p = at(s, s.locked[a] ? a : b);
    return plan(quadricError(q, ...p), p);
  }
  const pa = at(s, a);
  const pb = at(s, b);
  const opt = optimalPoint(q);
  const mid: Point = [(pa[0] + pb[0]) / 2, (pa[1] + pb[1]) / 2, (pa[2] + pb[2]) / 2];
  if (opt && dist2(opt, mid) <= 4 * dist2(pa, pb)) return plan(quadricError(q, ...opt), opt);
  const simple = bestSimplePoint(q, pa, pb);
  return plan(simple.cost, simple.p);
}

function triNormal(p0: Point, p1: Point, p2: Point): Point {
  return crossOf([p1[0] - p0[0], p1[1] - p0[1], p1[2] - p0[2]], [p2[0] - p0[0], p2[1] - p0[1], p2[2] - p0[2]]);
}

/** Checks that a collapse keeps the surface manifold, unfolded and non-degenerate. */
export class LinkCheck {
  private readonly markA: Int32Array;
  private readonly markB: Int32Array;
  private stamp = 0;

  constructor(private readonly s: Soup) {
    this.markA = new Int32Array(s.vertCount);
    this.markB = new Int32Array(s.vertCount);
  }

  /** a fresh stamp for marking neighbours */
  nextStamp(): number {
    return ++this.stamp;
  }

  /** marks a's neighbours; returns how many there are and how many live triangles hold both a and b */
  private markNeighboursOfA(a: number, b: number, stamp: number): { count: number; shared: number } {
    const s = this.s;
    let count = 0;
    let shared = 0;
    for (const t of s.vertTris[a]) {
      if (!s.triAlive[t]) continue;
      for (let k = 0; k < 3; k++) {
        const w = s.tri[t * 3 + k];
        if (w === b) shared++;
        if (w !== a && this.markA[w] !== stamp) {
          this.markA[w] = stamp;
          count++;
        }
      }
    }
    return { count, shared };
  }

  /** b's neighbours; returns how many and how many of them are also a's neighbours */
  private neighboursOfB(a: number, b: number, stamp: number): { count: number; common: number } {
    const s = this.s;
    let count = 0;
    let common = 0;
    for (const t of s.vertTris[b]) {
      if (!s.triAlive[t]) continue;
      for (let k = 0; k < 3; k++) {
        const w = s.tri[t * 3 + k];
        if (w === b || this.markB[w] === stamp) continue;
        this.markB[w] = stamp;
        count++;
        if (w !== a && this.markA[w] === stamp) common++;
      }
    }
    return { count, common };
  }

  /** link condition, degree and border rules */
  private keepsManifold(a: number, b: number): boolean {
    const s = this.s;
    const stamp = this.nextStamp();
    const na = this.markNeighboursOfA(a, b, stamp);
    if (!na.shared) return false;
    const nb = this.neighboursOfB(a, b, stamp);
    if (nb.common !== na.shared) return false;
    // would pinch two borders together
    if (s.border[a] && s.border[b] && na.shared !== 1) return false;
    // would collapse a tetrahedron or a lone triangle
    const minRemaining = s.border[a] || s.border[b] ? 2 : 3;
    return na.count - 1 + (nb.count - 1) - nb.common >= minRemaining;
  }

  /** no triangle around v (other than those the collapse removes) flips, folds or degenerates when v moves to p */
  private staysUnfolded(v: number, other: number, p: Point, edgeLen2: number): boolean {
    const s = this.s;
    for (const t of s.vertTris[v]) {
      if (!s.triAlive[t]) continue;
      const ids = [s.tri[t * 3], s.tri[t * 3 + 1], s.tri[t * 3 + 2]];
      if (ids.includes(v) && ids.includes(other)) continue;
      const before = triNormal(at(s, ids[0]), at(s, ids[1]), at(s, ids[2]));
      const moved = ids.map((i) => (i === v ? p : at(s, i)));
      const after = triNormal(moved[0], moved[1], moved[2]);
      const lb = Math.hypot(...before);
      const la = Math.hypot(...after);
      if (la < 1e-12 * edgeLen2 || la < 1e-24) return false;
      if (before[0] * after[0] + before[1] * after[1] + before[2] * after[2] < MIN_DOT * lb * la) return false;
    }
    return true;
  }

  allows(c: Collapse): boolean {
    if (!this.keepsManifold(c.a, c.b)) return false;
    const edgeLen2 = dist2(at(this.s, c.a), at(this.s, c.b));
    return this.staysUnfolded(c.a, c.b, c.p, edgeLen2) && this.staysUnfolded(c.b, c.a, c.p, edgeLen2);
  }
}
