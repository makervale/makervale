import type { Quat, Vec3 } from "../vec";
import type { Mesh } from "./mesh";
import { hasUV } from "./mesh";

/**
 * 4×4 affine matrices as 16 numbers in column-major order, the layout of three.js `Matrix4.elements`,
 * so callers holding a three.js matrix pass `matrix.elements`.
 */
export type Mat4 = ArrayLike<number>;

export const IDENTITY: readonly number[] = [1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1];

/** translation · rotation · scale, like three.js `Matrix4.compose` (an object's pos, quat, size) */
export function composeMatrix(pos: Vec3, quat: Quat, size: Vec3): number[] {
  const [x, y, z, w] = quat;
  const [x2, y2, z2] = [x + x, y + y, z + z];
  const [xx, xy, xz] = [x * x2, x * y2, x * z2];
  const [yy, yz, zz] = [y * y2, y * z2, z * z2];
  const [wx, wy, wz] = [w * x2, w * y2, w * z2];
  const [sx, sy, sz] = size;
  return [
    ...[(1 - (yy + zz)) * sx, (xy + wz) * sx, (xz - wy) * sx, 0],
    ...[(xy - wz) * sy, (1 - (xx + zz)) * sy, (yz + wx) * sy, 0],
    ...[(xz + wy) * sz, (yz - wx) * sz, (1 - (xx + yy)) * sz, 0],
    ...[pos[0], pos[1], pos[2], 1],
  ];
}

export function transformPoint(e: Mat4, p: Vec3): Vec3 {
  return [
    e[0] * p[0] + e[4] * p[1] + e[8] * p[2] + e[12],
    e[1] * p[0] + e[5] * p[1] + e[9] * p[2] + e[13],
    e[2] * p[0] + e[6] * p[1] + e[10] * p[2] + e[14],
  ];
}

/** determinant of the linear part */
function determinant3(e: Mat4): number {
  return e[0] * (e[5] * e[10] - e[9] * e[6]) - e[4] * (e[1] * e[10] - e[9] * e[2]) + e[8] * (e[1] * e[6] - e[5] * e[2]);
}

/** does the matrix mirror space (so face windings must flip)? */
export const isMirroring = (e: Mat4): boolean => determinant3(e) < 0;

/** the inverse of an affine matrix */
export function invertAffine(e: Mat4): number[] {
  const d = determinant3(e);
  // inverse of the linear part, column-major, by cofactors
  const a = [
    (e[5] * e[10] - e[9] * e[6]) / d,
    (e[9] * e[2] - e[1] * e[10]) / d,
    (e[1] * e[6] - e[5] * e[2]) / d,
    (e[8] * e[6] - e[4] * e[10]) / d,
    (e[0] * e[10] - e[8] * e[2]) / d,
    (e[4] * e[2] - e[0] * e[6]) / d,
    (e[4] * e[9] - e[8] * e[5]) / d,
    (e[8] * e[1] - e[0] * e[9]) / d,
    (e[0] * e[5] - e[4] * e[1]) / d,
  ];
  const t = [e[12], e[13], e[14]];
  const tx = -(a[0] * t[0] + a[3] * t[1] + a[6] * t[2]);
  const ty = -(a[1] * t[0] + a[4] * t[1] + a[7] * t[2]);
  const tz = -(a[2] * t[0] + a[5] * t[1] + a[8] * t[2]);
  return [a[0], a[1], a[2], 0, a[3], a[4], a[5], 0, a[6], a[7], a[8], 0, tx, ty, tz, 1];
}

/** a copy with every vertex transformed; a mirroring matrix flips the windings (UVs follow) */
export function transformMesh(m: Mesh, e: Mat4): Mesh {
  const mirror = isMirroring(e);
  const keepOrder = <T>(corners: T[]): T[] => (mirror ? corners.slice().reverse() : corners.slice());
  const out: Mesh = { v: m.v.map((p) => transformPoint(e, p)), f: m.f.map(keepOrder), fm: m.fm.slice() };
  if (hasUV(m)) out.uv = m.uv!.map((face) => keepOrder(face.map((q): [number, number] => [q[0], q[1]])));
  return out;
}
