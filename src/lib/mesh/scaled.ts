import type { Vec3 } from "../vec";
import { mul3, normalize } from "../vec";
import type { Mesh } from "./mesh";

/**
 * Meshes live in unit space; the object's size stretches them into metres. Operations whose
 * parameters are in metres (bevel width, solidify thickness, sharp angles…) measure in scaled space.
 */
const MIN_SIZE = 1e-9;

/** a size that can be divided by */
export const safeSize = (size: Vec3): Vec3 => [
  Math.max(size[0], MIN_SIZE),
  Math.max(size[1], MIN_SIZE),
  Math.max(size[2], MIN_SIZE),
];

/** vertex positions in metres */
export const scaledPositions = (m: Mesh, size: Vec3): Vec3[] => m.v.map((p) => mul3(p, size));

/** Newell normal (not normalised) of a polygon over the given positions */
export function newellNormalOf(positions: Vec3[], face: number[]): Vec3 {
  const n: Vec3 = [0, 0, 0];
  for (let i = 0; i < face.length; i++) {
    const a = positions[face[i]];
    const b = positions[face[(i + 1) % face.length]];
    n[0] += (a[1] - b[1]) * (a[2] + b[2]);
    n[1] += (a[2] - b[2]) * (a[0] + b[0]);
    n[2] += (a[0] - b[0]) * (a[1] + b[1]);
  }
  return n;
}

/** unit polygon normal measured in metres (the true normal of a non-uniformly scaled object) */
export function scaledNormal(m: Mesh, face: number[], size: Vec3): Vec3 {
  const n: Vec3 = [0, 0, 0];
  for (let i = 0; i < face.length; i++) {
    const a = mul3(m.v[face[i]], size);
    const b = mul3(m.v[face[(i + 1) % face.length]], size);
    n[0] += (a[1] - b[1]) * (a[2] + b[2]);
    n[1] += (a[2] - b[2]) * (a[0] + b[0]);
    n[2] += (a[0] - b[0]) * (a[1] + b[1]);
  }
  return normalize(n);
}
