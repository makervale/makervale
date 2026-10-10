import type { Vec3 } from "../../vec";
import { add, dot, normalize, scale, sub } from "../../vec";
import type { Mesh } from "../mesh";
import { faceNormal } from "../mesh";
import { average } from "../points";
import { topologyOf } from "../topology";
import { angleInPlane, fitPlane, sortedAroundCenter } from "./plane-fit";

/** Operations that only move vertices (the topology stays, so nothing is invalidated). */

/** Laplacian smoothing: each vertex moves toward the average of its neighbours. */
export function smooth(m: Mesh, verts: Set<number>, iters = 2, factor = 0.5): void {
  const t = topologyOf(m);
  for (let it = 0; it < iters; it++) {
    const next = m.v.map((p): Vec3 => [...p]);
    for (const vi of verts) {
      const nbrs = t.vertNbrs[vi];
      if (!nbrs.length) continue;
      const c = average(nbrs.map((j) => m.v[j]));
      next[vi] = add(m.v[vi], scale(sub(c, m.v[vi]), factor));
    }
    m.v = next;
  }
}

/** Move each selected vertex along its own normal (inflate / deflate). */
export function pushAlongNormals(m: Mesh, verts: Set<number>, dist: number): void {
  const t = topologyOf(m);
  const normals = m.f.map((face) => faceNormal(m, face));
  for (const v of verts) {
    let n: Vec3 = [0, 0, 0];
    for (const f of t.vertFaces[v]) n = add(n, normals[f]);
    m.v[v] = add(m.v[v], scale(normalize(n), dist));
  }
}

/** Place a closed loop of vertices on a circle around their centre, in their best-fit plane. */
export function toCircle(m: Mesh, verts: Set<number>): boolean {
  const ids = [...verts];
  if (ids.length < 3) return false;
  const plane = fitPlane(m, ids);
  if (!plane) return false;
  const ordered = sortedAroundCenter(m, plane, ids);
  let radius = 0;
  for (const i of ids) {
    const d = sub(m.v[i], plane.center);
    radius += Math.hypot(dot(d, plane.u), dot(d, plane.v)) / ids.length;
  }
  const a0 = angleInPlane(m, plane, ordered[0]);
  ordered.forEach((i, k) => {
    const a = a0 + (k / ids.length) * Math.PI * 2;
    const spoke = add(scale(plane.u, Math.cos(a)), scale(plane.v, Math.sin(a)));
    m.v[i] = add(plane.center, scale(spoke, radius));
  });
  return true;
}
