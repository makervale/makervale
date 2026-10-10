import type { Vec3 } from "../vec";
import { add, clamp, dot, normalize, scale, sub } from "../vec";
import type { BevelPoints } from "./bevel-points";
import type { Cap } from "./bevel-caps";
import { edgeKey } from "./mesh";
import { average } from "./points";

/** Rounding: every strip end gets arc points, spliced into every polygon using that edge. */
export interface BevelParts {
  faces: number[][];
  faceSlots: number[];
  strips: number[][];
  stripSlots: number[];
  caps: Cap[];
  capSlots: number[];
}

/** how far a fanned cap's centre leans toward the old corner */
const CAP_PULL = Math.cos(Math.PI / 4);

/** arcs between the two ends of each strip side, as rational quadratic Béziers with the old vertex as control */
class Arcs {
  private readonly byEdge = new Map<string, { from: number; pts: number[] }>();

  constructor(
    private readonly points: BevelPoints,
    private readonly segments: number,
  ) {}

  private build(a: number, b: number): number[] {
    const P = this.points.pos;
    const v = this.points.owner[a];
    const [A, B, C] = [P[a], P[b], P[v]];
    const cosCorner = clamp(dot(normalize(sub(A, C)), normalize(sub(B, C))), -1, 1);
    const weight = Math.cos((Math.PI - Math.acos(cosCorner)) / 2);
    const pts: number[] = [];
    for (let i = 1; i < this.segments; i++) {
      const s = i / this.segments;
      const [b0, b1, b2] = [(1 - s) * (1 - s), 2 * s * (1 - s) * weight, s * s];
      const p = add(add(scale(A, b0), scale(C, b1)), scale(B, b2));
      pts.push(this.points.add(scale(p, 1 / (b0 + b1 + b2)), v));
    }
    return pts;
  }

  /** the arc points from a to b (made on first use) */
  of(a: number, b: number): number[] {
    const key = edgeKey(a, b);
    let arc = this.byEdge.get(key);
    if (!arc) {
      arc = { from: a, pts: this.build(a, b) };
      this.byEdge.set(key, arc);
    }
    return arc.from === a ? arc.pts : arc.pts.slice().reverse();
  }

  /** the polygon with arc points inserted along every rounded edge */
  splice(p: number[]): number[] {
    return p.flatMap((a, k) => {
      const b = p[(k + 1) % p.length];
      return this.byEdge.has(edgeKey(a, b)) ? [a, ...this.of(a, b)] : [a];
    });
  }
}

/** each strip becomes `segments` quads following its two arcs */
function roundStrips(arcs: Arcs, parts: BevelParts, segments: number, out: { polys: number[][]; slots: number[] }) {
  parts.strips.forEach(([a, b, c, d], i) => {
    const u = [b, ...arcs.of(b, c), c];
    const v = [a, ...arcs.of(a, d), d];
    for (let k = 0; k < segments; k++) {
      out.polys.push([v[k], u[k], u[k + 1], v[k + 1]]);
      out.slots.push(parts.stripSlots[i]);
    }
  });
}

/** small caps stay one polygon; bigger ones become a fan around a centre pushed toward the old corner */
function roundCap(points: BevelPoints, q: number[], owner: number): number[][] {
  if (q.length <= 4) return [q];
  const c = average(q.map((j) => points.pos[j]));
  const centre: Vec3 = scale(add(c, scale(points.pos[owner], CAP_PULL)), 1 / (1 + CAP_PULL));
  const ci = points.add(centre, owner);
  return q.map((x, k) => [x, q[(k + 1) % q.length], ci]);
}

export function roundBevel(points: BevelPoints, parts: BevelParts, segments: number) {
  const arcs = new Arcs(points, segments);
  const rounded = { polys: [] as number[][], slots: [] as number[] };
  roundStrips(arcs, parts, segments, rounded);
  const polys = parts.faces.map((p) => arcs.splice(p)).concat(rounded.polys);
  const slots = parts.faceSlots.concat(rounded.slots);
  parts.caps.forEach((cap, i) => {
    for (const p of roundCap(points, arcs.splice(cap.loop), cap.owner)) {
      polys.push(p);
      slots.push(parts.capSlots[i]);
    }
  });
  return { polys, slots };
}
