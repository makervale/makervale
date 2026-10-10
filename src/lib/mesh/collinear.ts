import { dot, length, sub } from "../vec";
import type { Mesh } from "./mesh";
import { edgeKey } from "./mesh";
import type { Topology } from "./topology";
import { invalidateTopology, topologyOf } from "./topology";

const MAX_PASSES = 64;

/** can v go: exactly two edges meeting in a straight line, no neighbour already going, no face dropping below 3? */
function isRemovable(m: Mesh, t: Topology, v: number, ctx: { drop: Set<number>; left: number[]; minCos: number }) {
  const nbrs = t.vertNbrs[v];
  if (nbrs.length !== 2) return false;
  const [u, w] = nbrs;
  if (ctx.drop.has(u) || ctx.drop.has(w) || t.edges.has(edgeKey(u, w))) return false;
  if (t.vertFaces[v].some((f) => ctx.left[f] <= 3)) return false;
  const d1 = sub(m.v[v], m.v[u]);
  const d2 = sub(m.v[w], m.v[v]);
  const l1 = length(d1);
  const l2 = length(d2);
  return l1 > 0 && l2 > 0 && dot(d1, d2) / (l1 * l2) >= ctx.minCos;
}

/** one pass; returns the vertices it removed from the faces */
function removalPass(m: Mesh, minCos: number): number {
  const t = topologyOf(m);
  const ctx = { drop: new Set<number>(), left: m.f.map((face) => face.length), minCos };
  for (let v = 0; v < m.v.length; v++) {
    if (!isRemovable(m, t, v, ctx)) continue;
    ctx.drop.add(v);
    for (const f of t.vertFaces[v]) ctx.left[f]--;
  }
  if (ctx.drop.size) {
    m.f = m.f.map((face) => face.filter((i) => !ctx.drop.has(i)));
    invalidateTopology(m);
  }
  return ctx.drop.size;
}

/**
 * Remove vertices where exactly two edges meet in a straight line (they only add corners to polygons).
 * Runs in passes because neighbouring removable vertices are never removed together.
 * The vertices stay in `m.v` (unused); the caller drops orphans.
 */
export function removeCollinear(m: Mesh, angleDeg: number): void {
  const minCos = Math.cos((angleDeg * Math.PI) / 180);
  for (let pass = 0; pass < MAX_PASSES; pass++) if (!removalPass(m, minCos)) return;
}
