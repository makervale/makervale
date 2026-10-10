import type { Vec3 } from "../vec";
import type { Mesh, UV } from "./mesh";
import { scaledPositions } from "./scaled";
import { polygonFrame } from "./uv-project";

/**
 * Per-face-corner texture coordinates: m.uv[fi][k] is the UV of corner k of face fi.
 * The projections live in uv-project.ts (box, cylinder) and uv-smart.ts; this file holds the checks.
 */
export { boxUV, cylinderUV } from "./uv-project";
export { smartUV } from "./uv-smart";

/** a hash of the face list; when it changes, stored UVs no longer fit */
export function faceSignature(m: Mesh): string {
  let h = 0x811c9dc5 ^ m.f.length;
  h = Math.imul(h, 0x01000193);
  for (const face of m.f) {
    h = Math.imul(h ^ (face.length | 0x40000000), 0x01000193);
    for (const v of face) h = Math.imul(h ^ v, 0x01000193);
  }
  return `${m.f.length}:${m.v.length}:${(h >>> 0).toString(36)}`;
}

/** m.uv exists, matches the face list corner for corner, and holds only finite numbers */
export function uvValid(m: Mesh): boolean {
  const uv = m.uv;
  if (!uv || uv.length !== m.f.length) return false;
  return m.f.every(
    (face, i) => !!uv[i] && uv[i].length === face.length && uv[i].every((q) => q && isFinite(q[0]) && isFinite(q[1])),
  );
}

/** keep m.uv[fi] aligned after m.f[fi].reverse(); no-op without UVs */
export function reverseUV(m: Mesh, fi: number): void {
  m.uv?.[fi]?.reverse();
}

function uvArea(q: UV[]): number {
  let s = 0;
  for (let k = 0; k < q.length; k++) {
    const a = q[k];
    const b = q[(k + 1) % q.length];
    s += a[0] * b[1] - a[1] * b[0];
  }
  return Math.abs(s) / 2;
}

/**
 * Area distortion: the area-weighted mean |log(share of 3D area / share of UV area)| over faces.
 * 0 means uniform texel density; Infinity when there are no usable UVs.
 */
export function uvStretch(m: Mesh, size: Vec3): number {
  if (!uvValid(m)) return Infinity;
  const P = scaledPositions(m, size);
  const a3 = m.f.map((face) => polygonFrame(P, face).area);
  const a2 = m.uv!.map(uvArea);
  const s3 = a3.reduce((s, x) => s + x, 0);
  const s2 = a2.reduce((s, x) => s + x, 0);
  if (!(s3 > 0) || !(s2 > 0)) return Infinity;
  let acc = 0;
  for (let i = 0; i < a3.length; i++) acc += a3[i] * Math.abs(Math.log(a3[i] / s3 / Math.max(a2[i] / s2, 1e-9)));
  return acc / s3;
}

const uvKey = (q: UV): string => `${Math.round(q[0] * 1e6)},${Math.round(q[1] * 1e6)}`;

/** every face edge in UV space once (seams appear once per side), flat: [u0, v0, u1, v1, …] */
export function uvSegments(m: Mesh): number[] {
  if (!uvValid(m)) return [];
  const seen = new Set<string>();
  const out: number[] = [];
  for (const q of m.uv!) {
    q.forEach((a, k) => {
      const b = q[(k + 1) % q.length];
      const [ka, kb] = [uvKey(a), uvKey(b)];
      const key = ka < kb ? `${ka}|${kb}` : `${kb}|${ka}`;
      if (ka === kb || seen.has(key)) return;
      seen.add(key);
      out.push(a[0], a[1], b[0], b[1]);
    });
  }
  return out;
}
