import { dot, normalize, sub } from "../../vec";
import type { Plane } from "../axis";
import type { Mesh } from "../mesh";

/** Which side of a plane vertices lie on. */

/** points closer to the plane than this count as on it */
export const ON_PLANE = 1e-7;

export type Side = -1 | 0 | 1;

/** signed distance to the plane per vertex (reads current positions, so new vertices work too) */
export function planeDistance(m: Mesh, plane: Plane): (i: number) => number {
  const n = normalize(plane.n);
  return (i) => dot(sub(m.v[i], plane.p), n);
}

export function sideOf(distance: number): Side {
  if (Math.abs(distance) <= ON_PLANE) return 0;
  return distance > 0 ? 1 : -1;
}
