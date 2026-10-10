import type { Vec3 } from "../vec";
import { length, normalize } from "../vec";
import type { Mesh, UV } from "./mesh";
import { newellNormalOf, scaledPositions } from "./scaled";

/**
 * Simple projections writing `m.uv` (one UV per face corner). `size` is the object's size:
 * positions are measured in metres so texel density is uniform.
 */

/** unit normal and area of a polygon over the given positions */
export function polygonFrame(positions: Vec3[], face: number[]): { n: Vec3; area: number } {
  const n = newellNormalOf(positions, face);
  return { n: normalize(n), area: length(n) / 2 };
}

/** the axis (0, 1, 2) the normal points along most; ties go to Z */
function dominantAxis(n: Vec3): number {
  return [0, 1, 2].reduce((best, k) => (Math.abs(n[k]) > Math.abs(n[best]) ? k : best), 2);
}

/** (U, V) on the cube side facing `axis`, with U × V = the outward axis so nothing is mirrored */
function cubeSideUV(q: Vec3, axis: number, sign: number): UV {
  if (axis === 0) return [sign * q[1], q[2]];
  if (axis === 1) return [-sign * q[0], q[2]];
  return [q[0], sign * q[1]];
}

/** Cube projection by each face's dominant normal axis, in metres: textures tile at real-world scale. */
export function boxUV(m: Mesh, size: Vec3 = [1, 1, 1]): void {
  const P = scaledPositions(m, size);
  m.uv = m.f.map((face) => {
    const n = polygonFrame(P, face).n;
    const axis = dominantAxis(n);
    const sign = n[axis] >= 0 ? 1 : -1;
    return face.map((i) => cubeSideUV(P[i], axis, sign));
  });
}

const TAU = Math.PI * 2;
/** faces turned further than this toward ±Z are caps */
const CAP_NORMAL_Z = 0.7;

/** a side face: u is the angle around Z, unwrapped near the face's own centre angle so it never spans the seam */
function wrapFace(m: Mesh, face: number[]): UV[] {
  let cx = 0;
  let cy = 0;
  for (const i of face) {
    cx += m.v[i][0] / face.length;
    cy += m.v[i][1] / face.length;
  }
  const centre = Math.atan2(cy, cx) / TAU;
  const us = face.map((i) => {
    const q = m.v[i];
    // a pole takes the face's centre angle
    const u = Math.hypot(q[0], q[1]) < 1e-9 ? centre : Math.atan2(q[1], q[0]) / TAU;
    return u - Math.round(u - centre);
  });
  // the face starts inside [0, 1)
  const shift = Math.floor(Math.min(...us));
  return face.map((i, k) => [us[k] - shift, m.v[i][2] + 0.5]);
}

/**
 * Wrap around local Z: u = angle / 2π, v = z + 0.5; caps get a planar top-down projection.
 * Coordinates span the unit square (in unit space, not metres).
 */
export function cylinderUV(m: Mesh, size: Vec3 = [1, 1, 1]): void {
  const P = scaledPositions(m, size);
  m.uv = m.f.map((face) => {
    const n = polygonFrame(P, face).n;
    if (Math.abs(n[2]) <= CAP_NORMAL_Z) return wrapFace(m, face);
    const sign = n[2] >= 0 ? 1 : -1;
    return face.map((i): UV => [m.v[i][0] + 0.5, sign * m.v[i][1] + 0.5]);
  });
}
