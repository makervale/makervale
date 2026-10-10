import type { PlaneEq } from "./decimate-quadric";
import { Quadrics } from "./decimate-quadric";
import type { Mesh } from "./mesh";
import { triangulatePoly } from "./triangulate";

/** weight of the virtual planes that pin border edges (relative to face area) */
const BORDER_PENALTY = 1000;

/** The triangulated working copy decimation edits, in typed arrays for speed. */
export interface Soup {
  vertCount: number;
  triCount: number;
  /** three vertex indices per triangle */
  tri: Int32Array;
  triSlot: number[];
  triAlive: Uint8Array;
  /** xyz per vertex */
  pos: Float64Array;
  /** the triangles around each vertex (may hold dead ones until cleaned) */
  vertTris: number[][];
  vertAlive: Uint8Array;
  /** on an open border or a non-manifold edge */
  border: Uint8Array;
  /** may not move */
  locked: Uint8Array;
  /** bumped on every change, so queued collapses can tell they are stale */
  version: Int32Array;
  quadrics: Quadrics;
}

export function soupOf(m: Mesh): Soup {
  const tris: number[] = [];
  const triSlot: number[] = [];
  m.f.forEach((face, fi) => {
    for (const t of triangulatePoly(m, face)) {
      tris.push(t[0], t[1], t[2]);
      triSlot.push(m.fm[fi]);
    }
  });
  const n = m.v.length;
  const pos = new Float64Array(n * 3);
  m.v.forEach((p, i) => pos.set(p, i * 3));
  const s: Soup = {
    vertCount: n,
    triCount: triSlot.length,
    tri: Int32Array.from(tris),
    triSlot,
    triAlive: new Uint8Array(triSlot.length).fill(1),
    pos,
    vertTris: Array.from({ length: n }, () => []),
    vertAlive: new Uint8Array(n).fill(1),
    border: new Uint8Array(n),
    locked: new Uint8Array(n),
    version: new Int32Array(n),
    quadrics: new Quadrics(n),
  };
  for (let t = 0; t < s.triCount; t++) for (let k = 0; k < 3; k++) s.vertTris[s.tri[t * 3 + k]].push(t);
  return s;
}

/** p[b] − p[a] */
export function span(s: Soup, a: number, b: number): [number, number, number] {
  return [s.pos[b * 3] - s.pos[a * 3], s.pos[b * 3 + 1] - s.pos[a * 3 + 1], s.pos[b * 3 + 2] - s.pos[a * 3 + 2]];
}

export const crossOf = (u: number[], w: number[]): [number, number, number] => [
  u[1] * w[2] - u[2] * w[1],
  u[2] * w[0] - u[0] * w[2],
  u[0] * w[1] - u[1] * w[0],
];

/** the plane through vertex a with the given (not yet unit) normal; null when the normal vanishes */
function planeAt(s: Soup, a: number, n: number[]): { plane: PlaneEq; len: number } | null {
  const len = Math.hypot(n[0], n[1], n[2]);
  if (len < 1e-300) return null;
  const [x, y, z] = [n[0] / len, n[1] / len, n[2] / len];
  return { plane: [x, y, z, -(x * s.pos[a * 3] + y * s.pos[a * 3 + 1] + z * s.pos[a * 3 + 2])], len };
}

/** each triangle's plane goes into its corners' quadrics, weighted by area; returns unit normals */
export function addFacePlanes(s: Soup): Float64Array {
  const normals = new Float64Array(s.triCount * 3);
  for (let t = 0; t < s.triCount; t++) {
    const a = s.tri[t * 3];
    const fp = planeAt(s, a, crossOf(span(s, a, s.tri[t * 3 + 1]), span(s, a, s.tri[t * 3 + 2])));
    if (!fp) continue;
    normals.set(fp.plane.slice(0, 3), t * 3);
    for (let k = 0; k < 3; k++) s.quadrics.addPlane(s.tri[t * 3 + k], fp.plane, fp.len / 2);
  }
  return normals;
}

/** a heavy plane through edge a-b, perpendicular to triangle t, keeps the edge where it is */
function addBorderPlane(s: Soup, [a, b]: [number, number], t: number, normals: Float64Array): void {
  const e = span(s, a, b);
  const fp = planeAt(s, a, crossOf(e, [normals[t * 3], normals[t * 3 + 1], normals[t * 3 + 2]]));
  if (!fp) return;
  const w = BORDER_PENALTY * (e[0] * e[0] + e[1] * e[1] + e[2] * e[2]);
  s.quadrics.addPlane(a, fp.plane, w);
  s.quadrics.addPlane(b, fp.plane, w);
}

/** undirected edge key a·n + b (a < b) → its triangles */
export function soupEdges(s: Soup): Map<number, number[]> {
  const edges = new Map<number, number[]>();
  for (let t = 0; t < s.triCount; t++) {
    for (let k = 0; k < 3; k++) {
      const a = s.tri[t * 3 + k];
      const b = s.tri[t * 3 + ((k + 1) % 3)];
      const key = a < b ? a * s.vertCount + b : b * s.vertCount + a;
      const list = edges.get(key);
      if (list) list.push(t);
      else edges.set(key, [t]);
    }
  }
  return edges;
}

/** open borders and material borders get pinning planes; non-manifold edges are left alone */
export function markBorders(s: Soup, edges: Map<number, number[]>, normals: Float64Array, keepBoundary: boolean) {
  for (const [key, tris] of edges) {
    const a = Math.floor(key / s.vertCount);
    const b = key - a * s.vertCount;
    if (tris.length === 1) {
      s.border[a] = s.border[b] = 1;
      addBorderPlane(s, [a, b], tris[0], normals);
      if (keepBoundary) s.locked[a] = s.locked[b] = 1;
    } else if (tris.length > 2) {
      s.border[a] = s.border[b] = 1;
      s.locked[a] = s.locked[b] = 1;
    } else if (s.triSlot[tris[0]] !== s.triSlot[tris[1]]) {
      addBorderPlane(s, [a, b], tris[0], normals);
      addBorderPlane(s, [a, b], tris[1], normals);
    }
  }
}
