import type { Vec3 } from "../vec";
import { add, cross, dot, normalize, scale, sub } from "../vec";

/** A line in space: a point on it and its direction (any length). */
export interface Axis {
  p: Vec3;
  d: Vec3;
}

/** A plane: a point on it and its normal (any length). */
export interface Plane {
  p: Vec3;
  n: Vec3;
}

/** Rodrigues' rotation of a point about an axis by `radians` (right-handed around d). */
export function rotateAbout(point: Vec3, axis: Axis, radians: number): Vec3 {
  const k = normalize(axis.d);
  const v = sub(point, axis.p);
  const c = Math.cos(radians);
  const s = Math.sin(radians);
  const turned = add(add(scale(v, c), scale(cross(k, v), s)), scale(k, dot(k, v) * (1 - c)));
  return add(axis.p, turned);
}

export const degToRad = (deg: number): number => (deg * Math.PI) / 180;

/** is this sweep a full turn (±360°)? */
export const isFullTurn = (deg: number): boolean => Math.abs(Math.abs(deg) - 360) < 1e-6;
