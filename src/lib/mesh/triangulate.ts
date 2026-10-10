import type { Vec3 } from "../vec";
import { cross, dot, normalize, sub } from "../vec";
import type { Mesh } from "./mesh";
import { faceNormal } from "./mesh";
import type { Point2 } from "./ear-clip";
import { earClip } from "./ear-clip";

/** Triangulation of single polygons: a fan for convex ones, ear clipping otherwise. */
export function isConvex(m: Mesh, face: number[], normal?: Vec3): boolean {
  if (face.length <= 3) return true;
  const n = normal ?? faceNormal(m, face);
  for (let k = 0; k < face.length; k++) {
    const a = m.v[face[k]];
    const b = m.v[face[(k + 1) % face.length]];
    const c = m.v[face[(k + 2) % face.length]];
    if (dot(cross(sub(b, a), sub(c, b)), n) < -1e-12) return false;
  }
  return true;
}

function fan(face: number[]): number[][] {
  const out: number[][] = [];
  for (let i = 1; i < face.length - 1; i++) out.push([face[0], face[i], face[i + 1]]);
  return out;
}

/** two unit axes spanning the plane perpendicular to n, with U × V = n */
export function planeBasis(n: Vec3): [Vec3, Vec3] {
  const helper: Vec3 = Math.abs(n[0]) < 0.9 ? [1, 0, 0] : [0, 1, 0];
  const u = normalize(cross(helper, n));
  return [u, cross(n, u)];
}

/** triangles as vertex-index triples, wound like the polygon */
export function triangulatePoly(m: Mesh, face: number[]): number[][] {
  if (face.length === 3) return [face.slice()];
  const n = faceNormal(m, face);
  if (isConvex(m, face, n)) return fan(face);
  const [u, v] = planeBasis(n);
  const pts: Point2[] = face.map((i) => [dot(m.v[i], u), dot(m.v[i], v)]);
  const tris = earClip(pts);
  if (!tris.length) return fan(face);
  return tris.map((t) => t.map((k) => face[k]));
}
