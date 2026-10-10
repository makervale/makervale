/** Picking mesh elements: by screen distance around the face under the cursor, honouring the element filter. */
import * as THREE from "three";
import type { Mesh } from "@/lib/mesh/mesh";
import { edgeKey } from "@/lib/mesh/mesh";
import type { EditMode } from "@/lib/mesh/selection";
import type { Store } from "@/app/store";
import type { Adjacency } from "./adjacency";
import { adjacencyOf } from "./adjacency";
import type { ObjectViews } from "./objects";
import type { Picker, ScreenPoint, WorldHit } from "./picking";
import type { ElementPick } from "./preselect";

export interface ElementPickDeps {
  picker: Picker;
  views: ObjectViews;
  store: Store;
  revisionOf(mesh: Mesh): number;
}

const VERTEX_RADIUS_PX = 10;
const EDGE_RADIUS_PX = 7;
/** past this many vertices the silhouette fallback (every vertex) is too slow */
const SILHOUETTE_LIMIT = 20000;

interface Context {
  m: Mesh;
  M: THREE.Matrix4;
  adj: Adjacency;
  hit: WorldHit | null;
  x: number;
  y: number;
  screen(i: number): ScreenPoint;
  occluded(w: THREE.Vector3): boolean;
}

function makeContext(
  deps: ElementPickDeps,
  m: Mesh,
  M: THREE.Matrix4,
  hit: WorldHit | null,
  at: [number, number],
): Context {
  const cache = new Map<number, ScreenPoint>();
  const world = (i: number) => new THREE.Vector3().fromArray(m.v[i]).applyMatrix4(M);
  const camera = deps.picker.camera.position;
  return {
    m,
    M,
    adj: adjacencyOf(m, deps.revisionOf(m)),
    hit,
    x: at[0],
    y: at[1],
    screen: (i) => {
      let s = cache.get(i);
      if (!s) {
        s = deps.picker.screenOf(world(i));
        cache.set(i, s);
      }
      return s;
    },
    occluded: (w) => (hit ? camera.distanceTo(w) > hit.dist * 1.01 + 0.02 : false),
  };
}

/** candidates: the face under the cursor and its neighbours (fast), or every vertex (silhouette fallback) */
function candidates(c: Context): number[] | null {
  if (c.hit && c.hit.poly != null) {
    const vs = new Set<number>();
    for (const vi of c.m.f[c.hit.poly]) {
      vs.add(vi);
      for (const n of c.adj.neighbours[vi]) vs.add(n);
    }
    return [...vs];
  }
  if (c.m.v.length > SILHOUETTE_LIMIT) return null;
  return c.m.v.map((_, i) => i);
}

function nearestVertex(c: Context, cand: number[]): ElementPick | null {
  let best: ElementPick | null = null;
  let bestDist = VERTEX_RADIUS_PX;
  for (const i of cand) {
    const s = c.screen(i);
    if (s.z > 1) continue;
    const d = Math.hypot(s.x - c.x, s.y - c.y);
    if (d >= bestDist || c.occluded(new THREE.Vector3().fromArray(c.m.v[i]).applyMatrix4(c.M))) continue;
    bestDist = d;
    best = { type: "v", id: i };
  }
  return best;
}

/** distance from the cursor to the segment A–B on screen, and where along it */
function segmentDistance(c: Context, A: ScreenPoint, B: ScreenPoint): { d: number; t: number } {
  const dx = B.x - A.x;
  const dy = B.y - A.y;
  const L2 = dx * dx + dy * dy || 1;
  const t = Math.min(1, Math.max(0, ((c.x - A.x) * dx + (c.y - A.y) * dy) / L2));
  return { d: Math.hypot(A.x + dx * t - c.x, A.y + dy * t - c.y), t };
}

function nearestEdge(c: Context, cand: number[]): ElementPick | null {
  let best: ElementPick | null = null;
  let bestDist = EDGE_RADIUS_PX;
  const seen = new Set<string>();
  for (const a of cand) {
    for (const b of c.adj.neighbours[a]) {
      const key = edgeKey(a, b);
      if (seen.has(key)) continue;
      seen.add(key);
      const A = c.screen(a);
      const B = c.screen(b);
      if (A.z > 1 || B.z > 1) continue;
      const { d, t } = segmentDistance(c, A, B);
      if (d >= bestDist) continue;
      const mid = new THREE.Vector3().fromArray(c.m.v[a]).lerp(new THREE.Vector3().fromArray(c.m.v[b]), t);
      if (c.occluded(mid.applyMatrix4(c.M))) continue;
      bestDist = d;
      best = { type: "e", id: key };
    }
  }
  return best;
}

type Pickers = Record<EditMode, (c: Context, cand: number[]) => ElementPick | null>;

const faceUnder = (c: Context): ElementPick | null =>
  c.hit && c.hit.poly != null ? { type: "f", id: c.hit.poly } : null;

const PICKERS: Pickers = {
  object: () => null,
  vert: (c, cand) => nearestVertex(c, cand),
  edge: (c, cand) => nearestEdge(c, cand),
  face: (c) => faceUnder(c),
  auto: (c, cand) => nearestVertex(c, cand) ?? nearestEdge(c, cand) ?? faceUnder(c),
};

/** the element a click at (x, y) would select */
export function pickElement(deps: ElementPickDeps, x: number, y: number, modeOverride?: EditMode): ElementPick | null {
  const o = deps.store.editTarget();
  const M = o ? deps.views.worldMatrixOf(o) : null;
  if (!o || !M) return null;
  const c = makeContext(deps, o.mesh, M, deps.picker.pickWorld(x, y, o.id), [x, y]);
  const cand = candidates(c);
  return cand ? PICKERS[modeOverride ?? deps.store.selection.mode](c, cand) : null;
}
