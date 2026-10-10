import type { Collapse } from "./decimate-collapse";
import { LinkCheck, planCollapse } from "./decimate-collapse";
import { MinHeap } from "./decimate-heap";
import type { Soup } from "./decimate-soup";
import { addFacePlanes, markBorders, soupEdges, soupOf } from "./decimate-soup";
import type { Mesh } from "./mesh";
import { triangleCount } from "./mesh";
import { trisToQuads } from "./ops/tris-to-quads";
import { dropOrphans } from "./ops/rewrite";
import { invalidateTopology } from "./topology";

/**
 * Mesh simplification by quadric-error edge collapse (Garland–Heckbert). Works on a triangulated copy,
 * keeps the surface manifold and consistently oriented, preserves open borders and material borders,
 * then re-pairs flat triangle pairs into quads. Mutates the mesh in place.
 */

/** flat triangle pairs within this many degrees become quads again */
const REQUAD_ANGLE_DEG = 5;

export interface DecimateOptions {
  /** never move open-border vertices */
  keepBoundary?: boolean;
}

function queue(s: Soup, heap: MinHeap<Collapse>, a: number, b: number): void {
  if (s.locked[a] && s.locked[b]) return;
  heap.push(planCollapse(s, a, b));
}

const isStale = (s: Soup, c: Collapse): boolean =>
  !s.vertAlive[c.a] || !s.vertAlive[c.b] || s.version[c.a] !== c.va || s.version[c.b] !== c.vb;

/** a triangle on the collapsing edge disappears; its third corner forgets it */
function killTriangle(s: Soup, t: number, [a, b]: [number, number]): void {
  s.triAlive[t] = 0;
  for (const v of s.tri.subarray(t * 3, t * 3 + 3)) {
    if (v !== a && v !== b) s.vertTris[v] = s.vertTris[v].filter((x) => x !== t);
  }
}

/** triangle t's corner `from` becomes `to` */
function moveCorner(s: Soup, t: number, from: number, to: number): void {
  for (let k = t * 3; k < t * 3 + 3; k++) if (s.tri[k] === from) s.tri[k] = to;
  s.vertTris[to].push(t);
}

/** merge the pair at the planned point; returns the surviving vertex and how many triangles died */
function collapse(s: Soup, c: Collapse): { survivor: number; died: number } {
  // the pinned vertex survives
  const [a, b] = s.locked[c.b] ? [c.b, c.a] : [c.a, c.b];
  s.pos.set(c.p, a * 3);
  s.quadrics.absorb(a, b);
  s.vertAlive[b] = 0;
  s.border[a] |= s.border[b];
  s.locked[a] |= s.locked[b];
  let died = 0;
  for (const t of s.vertTris[b]) {
    if (!s.triAlive[t]) continue;
    if (s.tri.subarray(t * 3, t * 3 + 3).includes(a)) {
      killTriangle(s, t, [a, b]);
      died++;
    } else {
      moveCorner(s, t, b, a);
    }
  }
  s.vertTris[a] = s.vertTris[a].filter((t) => s.triAlive[t]);
  s.vertTris[b] = [];
  s.version[a]++;
  return { survivor: a, died };
}

/** queue a fresh collapse from a to each of its current neighbours */
function requeueAround(s: Soup, heap: MinHeap<Collapse>, link: LinkCheck, a: number, seen: Int32Array): void {
  const stamp = link.nextStamp();
  for (const t of s.vertTris[a]) {
    for (let k = 0; k < 3; k++) {
      const w = s.tri[t * 3 + k];
      if (w === a || seen[w] === stamp) continue;
      seen[w] = stamp;
      queue(s, heap, a, w);
    }
  }
}

function collapseUntil(s: Soup, heap: MinHeap<Collapse>, target: number): void {
  const link = new LinkCheck(s);
  const seen = new Int32Array(s.vertCount);
  let alive = s.triCount;
  while (alive > target && heap.size) {
    const c = heap.pop()!;
    if (isStale(s, c) || !link.allows(c)) continue;
    const { survivor, died } = collapse(s, c);
    alive -= died;
    requeueAround(s, heap, link, survivor, seen);
  }
}

/** write the soup back, recover quads on flat pairs, drop removed vertices */
function writeBack(m: Mesh, s: Soup): void {
  m.v = m.v.map((_, i) => [s.pos[i * 3], s.pos[i * 3 + 1], s.pos[i * 3 + 2]]);
  m.f = [];
  m.fm = [];
  for (let t = 0; t < s.triCount; t++) {
    if (!s.triAlive[t]) continue;
    m.f.push([s.tri[t * 3], s.tri[t * 3 + 1], s.tri[t * 3 + 2]]);
    m.fm.push(s.triSlot[t]);
  }
  invalidateTopology(m);
  trisToQuads(m, new Set(m.f.keys()), REQUAD_ANGLE_DEG);
  dropOrphans(m);
  invalidateTopology(m);
}

/** Reduce the triangle count to about `ratio` of what it was. Returns the counts before and after. */
export function decimate(m: Mesh, ratio: number, opts: DecimateOptions = {}): { before: number; after: number } {
  const before = triangleCount(m);
  const s = soupOf(m);
  const target = Math.max(2, Math.floor(s.triCount * Math.max(0, ratio)));
  if (ratio >= 1 || s.triCount <= target) return { before, after: before };
  const normals = addFacePlanes(s);
  const edges = soupEdges(s);
  markBorders(s, edges, normals, !!opts.keepBoundary);
  const heap = new MinHeap<Collapse>();
  for (const key of edges.keys()) {
    const a = Math.floor(key / s.vertCount);
    queue(s, heap, a, key - a * s.vertCount);
  }
  collapseUntil(s, heap, target);
  writeBack(m, s);
  return { before, after: triangleCount(m) };
}
