import type { Vec3 } from "../vec";
import { lerp, scale } from "../vec";
import type { Mesh } from "./mesh";

/** Point helpers shared by the operations. */
export const lerp3 = (a: Vec3, b: Vec3, t: number): Vec3 => [
  lerp(a[0], b[0], t),
  lerp(a[1], b[1], t),
  lerp(a[2], b[2], t),
];

/** the average position of some vertices */
export function centroid(m: Mesh, ids: Iterable<number>): Vec3 {
  const c: Vec3 = [0, 0, 0];
  let n = 0;
  for (const i of ids) {
    c[0] += m.v[i][0];
    c[1] += m.v[i][1];
    c[2] += m.v[i][2];
    n++;
  }
  return n ? scale(c, 1 / n) : c;
}

/** the average of some points */
export function average(points: Vec3[]): Vec3 {
  const c: Vec3 = [0, 0, 0];
  for (const p of points) {
    c[0] += p[0];
    c[1] += p[1];
    c[2] += p[2];
  }
  return points.length ? scale(c, 1 / points.length) : c;
}
