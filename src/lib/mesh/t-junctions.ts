import type { Vec3 } from "../vec";
import { add, cross, dot, length, scale, sub } from "../vec";
import type { Mesh } from "./mesh";
import { edgeKey } from "./mesh";
import { neighbourCells } from "./ops/merge";
import type { Topology } from "./topology";
import { faceRunsForward, invalidateTopology, topologyOf } from "./topology";

const MAX_PASSES = 4;

interface Hit {
  v: number;
  /** position along the edge, 0 at its start */
  t: number;
}

/** a spatial hash of the border vertices, its cell about one average open edge long */
class BorderGrid {
  private readonly cells = new Map<string, number[]>();
  readonly cellSize: number;
  readonly inv: number;

  constructor(m: Mesh, open: [number, number][], eps: number) {
    let sum = 0;
    for (const [a, b] of open) sum += length(sub(m.v[a], m.v[b]));
    this.cellSize = Math.max(eps * 4, sum / open.length);
    this.inv = 1 / this.cellSize;
    for (const v of new Set(open.flat())) {
      const key = this.cellOf(m.v[v]).join(",");
      const cell = this.cells.get(key);
      if (cell) cell.push(v);
      else this.cells.set(key, [v]);
    }
  }

  cellOf(p: Vec3): [number, number, number] {
    return [Math.floor(p[0] * this.inv), Math.floor(p[1] * this.inv), Math.floor(p[2] * this.inv)];
  }

  /** border vertices in the cells around p */
  near(p: Vec3): number[] {
    return neighbourCells(...this.cellOf(p)).flatMap((k) => this.cells.get(k) ?? []);
  }
}

/** border vertices lying on the open edge a→b (strictly between its ends, within eps of the line) */
function hitsOnEdge(m: Mesh, grid: BorderGrid, [a, b]: [number, number], eps: number): Hit[] {
  const start = m.v[a];
  const d = sub(m.v[b], start);
  const len = length(d);
  if (len <= eps) return [];
  const seen = new Set<number>();
  const hits: Hit[] = [];
  const steps = Math.ceil(len / (grid.cellSize * 0.5));
  for (let s = 0; s <= steps; s++) {
    for (const v of grid.near(add(start, scale(d, s / steps)))) {
      if (v === a || v === b || seen.has(v)) continue;
      seen.add(v);
      const w = sub(m.v[v], start);
      const t = dot(w, d) / (len * len);
      if (t * len <= eps || (1 - t) * len <= eps || length(cross(w, d)) / len > eps) continue;
      hits.push({ v, t });
    }
  }
  return hits;
}

/** per face: the corner after which hits go → the hits in order along the face */
type Insertions = Map<number, Map<number, Hit[]>>;

function planInsertions(m: Mesh, t: Topology, open: [number, number][], eps: number): Insertions {
  const grid = new BorderGrid(m, open, eps);
  const out: Insertions = new Map();
  for (const [a, b] of open) {
    const hits = hitsOnEdge(m, grid, [a, b], eps);
    if (!hits.length) continue;
    const fi = t.edges.get(edgeKey(a, b))!.faces[0];
    const forward = faceRunsForward(m, fi, a, b);
    if (!forward) for (const h of hits) h.t = 1 - h.t;
    const usable = hits.filter((h) => !m.f[fi].includes(h.v)).sort((x, y) => x.t - y.t);
    if (!usable.length) continue;
    if (!out.has(fi)) out.set(fi, new Map());
    out.get(fi)!.set(forward ? a : b, usable);
  }
  return out;
}

function applyInsertions(m: Mesh, plan: Insertions): void {
  for (const [fi, after] of plan) {
    const q: number[] = [];
    const push = (v: number): void => {
      if (!q.includes(v)) q.push(v);
    };
    for (const v of m.f[fi]) {
      q.push(v);
      for (const h of after.get(v) ?? []) push(h.v);
    }
    m.f[fi] = q;
  }
}

const countHits = (plan: Insertions): number =>
  [...plan.values()].reduce((n, after) => n + [...after.values()].reduce((k, hits) => k + hits.length, 0), 0);

/** Splice vertices that lie on open (one-face) edges into those edges. Returns how many were inserted. */
export function fixTJunctions(m: Mesh, eps = 1e-5): number {
  let total = 0;
  for (let pass = 0; pass < MAX_PASSES; pass++) {
    const t = topologyOf(m);
    const open: [number, number][] = [];
    for (const e of t.edges.values()) if (e.faces.length === 1) open.push([e.a, e.b]);
    if (!open.length) break;
    const plan = planInsertions(m, t, open, eps);
    const n = countHits(plan);
    if (!n) break;
    applyInsertions(m, plan);
    invalidateTopology(m);
    total += n;
  }
  return total;
}
