import type { Mesh } from "../mesh";
import { edgeKey, parseEdgeKey } from "../mesh";
import { ringWalk } from "../edge-loops";
import { lerp3 } from "../points";
import type { ElementSelection } from "../selection";
import { edgesSelection } from "../selection-of";
import { invalidateTopology } from "../topology";

/** new vertices on each cut edge, ordered from the lower vertex index to the higher */
class CutPoints {
  private readonly byEdge = new Map<string, number[]>();

  constructor(
    private readonly m: Mesh,
    private readonly cuts: number,
  ) {}

  of(key: string): number[] {
    let pts = this.byEdge.get(key);
    if (pts) return pts;
    const [lo, hi] = parseEdgeKey(key);
    pts = [];
    for (let i = 1; i <= this.cuts; i++) {
      this.m.v.push(lerp3(this.m.v[lo], this.m.v[hi], i / (this.cuts + 1)));
      pts.push(this.m.v.length - 1);
    }
    this.byEdge.set(key, pts);
    return pts;
  }

  /** the points ordered from u towards v */
  along(u: number, v: number): number[] {
    const pts = this.of(edgeKey(u, v));
    return u < v ? pts : pts.slice().reverse();
  }

  entries(): IterableIterator<[string, number[]]> {
    return this.byEdge.entries();
  }
}

/** faces outside the ring that share a cut edge get the new vertices spliced in (keeps the mesh closed) */
function spliceIntoFace(face: number[], key: string, pts: number[]): void {
  const [lo, hi] = parseEdgeKey(key);
  const ia = face.indexOf(lo);
  const ib = face.indexOf(hi);
  if (ia < 0 || ib < 0) return;
  const len = face.length;
  if ((ia + 1) % len === ib) face.splice(ib === 0 ? len : ib, 0, ...pts);
  else if ((ib + 1) % len === ia) face.splice(ia === 0 ? len : ia, 0, ...pts.slice().reverse());
}

/** Cut one or more parallel loops through the ring of quads that contains the edge. */
export function loopCut(m: Mesh, key: string, cuts = 1): ElementSelection {
  const { steps } = ringWalk(m, key);
  if (!steps.length) return edgesSelection([]);
  const n = Math.max(1, cuts | 0);
  const points = new CutPoints(m, n);
  const replaced = new Set<number>();
  const newFaces: number[][] = [];
  const newSlots: number[] = [];
  const newEdges: string[] = [];
  for (const s of steps) {
    const face = m.f[s.face];
    replaced.add(s.face);
    const i = face.findIndex((v, k) => edgeKey(v, face[(k + 1) % 4]) === s.ein);
    const [a, b, c, d] = [face[i], face[(i + 1) % 4], face[(i + 2) % 4], face[(i + 3) % 4]];
    const left = [a, ...points.along(a, b), b];
    const right = [d, ...points.along(d, c), c];
    for (let k = 0; k <= n; k++) {
      newFaces.push([left[k], left[k + 1], right[k + 1], right[k]]);
      newSlots.push(m.fm[s.face]);
    }
    for (let k = 1; k <= n; k++) newEdges.push(edgeKey(left[k], right[k]));
  }
  m.f.forEach((face, fi) => {
    if (replaced.has(fi)) return;
    for (const [k, pts] of points.entries()) spliceIntoFace(face, k, pts);
  });
  m.f = m.f.filter((_, i) => !replaced.has(i)).concat(newFaces);
  m.fm = m.fm.filter((_, i) => !replaced.has(i)).concat(newSlots);
  invalidateTopology(m);
  return edgesSelection(newEdges);
}
