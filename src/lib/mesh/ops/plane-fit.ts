import type { Vec3 } from "../../vec";
import { cross, dot, length, normalize, sub } from "../../vec";
import type { Mesh } from "../mesh";
import { centroid } from "../points";
import { planeBasis } from "../triangulate";

/** A plane through a cloud of vertices and a frame in it, for ordering the vertices around their centre. */
export interface FittedPlane {
  center: Vec3;
  normal: Vec3;
  u: Vec3;
  v: Vec3;
}

const MIN_SPAN = 1e-10;

/** best-fit plane normal: the largest cross product among spokes from the centre; null when all collinear */
export function fitPlane(m: Mesh, ids: number[]): FittedPlane | null {
  const center = centroid(m, ids);
  let normal: Vec3 | null = null;
  let best = MIN_SPAN;
  for (let a = 0; a < ids.length; a++) {
    for (let b = a + 1; b < ids.length; b++) {
      const c = cross(sub(m.v[ids[a]], center), sub(m.v[ids[b]], center));
      const l = length(c);
      if (l > best) {
        best = l;
        normal = c;
      }
    }
  }
  if (!normal) return null;
  const n = normalize(normal);
  const [u, v] = planeBasis(n);
  return { center, normal: n, u, v };
}

/** angle of a vertex around the plane's centre */
export function angleInPlane(m: Mesh, plane: FittedPlane, i: number): number {
  const d = sub(m.v[i], plane.center);
  return Math.atan2(dot(d, plane.v), dot(d, plane.u));
}

/** the vertices ordered counter-clockwise around the plane's centre */
export function sortedAroundCenter(m: Mesh, plane: FittedPlane, ids: number[]): number[] {
  return ids.slice().sort((a, b) => angleInPlane(m, plane, a) - angleInPlane(m, plane, b));
}
