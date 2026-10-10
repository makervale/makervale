import type { Vec3 } from "../vec";
import { cross, dot, normalize } from "../vec";
import type { UV } from "./mesh";

/** Flattening one chart: project it onto a plane, then turn it to its smallest bounding rectangle. */

/** two unit axes spanning the plane ⟂ n, with U × V = n so faces seen from outside stay counter-clockwise */
export function chartBasis(n: Vec3): [Vec3, Vec3] {
  const helper: Vec3 = Math.abs(n[2]) < 0.9 ? [0, 0, 1] : [0, 1, 0];
  const u = normalize(cross(helper, n));
  return [u, cross(n, u)];
}

export const projectOnto = (p: Vec3, [u, v]: [Vec3, Vec3]): UV => [dot(p, u), dot(p, v)];

const turn = (o: UV, a: UV, b: UV): number => (a[0] - o[0]) * (b[1] - o[1]) - (a[1] - o[1]) * (b[0] - o[0]);

/** convex hull, Andrew's monotone chain */
export function convexHull(pts: UV[]): UV[] {
  const s = pts.slice().sort((a, b) => a[0] - b[0] || a[1] - b[1]);
  if (s.length < 3) return s;
  const half = (order: UV[]): UV[] => {
    const out: UV[] = [];
    for (const p of order) {
      while (out.length >= 2 && turn(out[out.length - 2], out[out.length - 1], p) <= 0) out.pop();
      out.push(p);
    }
    return out.slice(0, -1);
  };
  return half(s).concat(half(s.slice().reverse()));
}

interface Box {
  x0: number;
  y0: number;
  x1: number;
  y1: number;
}

/** bounding box of the points turned by `angle` */
function rotatedBox(pts: UV[], angle: number): Box {
  const c = Math.cos(angle);
  const s = Math.sin(angle);
  const box = { x0: Infinity, y0: Infinity, x1: -Infinity, y1: -Infinity };
  for (const p of pts) {
    const x = p[0] * c - p[1] * s;
    const y = p[0] * s + p[1] * c;
    box.x0 = Math.min(box.x0, x);
    box.x1 = Math.max(box.x1, x);
    box.y0 = Math.min(box.y0, y);
    box.y1 = Math.max(box.y1, y);
  }
  return box;
}

/** the rotation that lays the hull's minimal-area rectangle flat, landscape */
function bestRotation(hull: UV[]): number {
  let bestArea = Infinity;
  let angle = 0;
  for (let k = 0; k < Math.max(1, hull.length); k++) {
    const next = hull[(k + 1) % hull.length];
    const a = hull.length > 1 ? Math.atan2(next[1] - hull[k][1], next[0] - hull[k][0]) : 0;
    const b = rotatedBox(hull, -a);
    const [w, h] = [b.x1 - b.x0, b.y1 - b.y0];
    // perimeter tie-break for flat hulls
    const area = w * h + 1e-12 * (w + h);
    if (area < bestArea - 1e-15) {
      bestArea = area;
      angle = h > w ? -a + Math.PI / 2 : -a;
    }
  }
  return angle;
}

/** turn the points (in place) to their best rectangle with its corner at the origin; returns its size */
export function layFlat(pts: UV[]): { w: number; h: number } {
  const angle = bestRotation(convexHull(pts));
  const c = Math.cos(angle);
  const s = Math.sin(angle);
  for (const p of pts) [p[0], p[1]] = [p[0] * c - p[1] * s, p[0] * s + p[1] * c];
  const box = rotatedBox(pts, 0);
  for (const p of pts) {
    p[0] -= box.x0;
    p[1] -= box.y0;
  }
  return { w: box.x1 - box.x0, h: box.y1 - box.y0 };
}
