/**
 * Garland–Heckbert error quadrics: per vertex a symmetric 4×4 matrix stored as its ten distinct
 * entries [aa ab ac ad bb bc bd cc cd dd]. The error of a point is the weighted sum of squared
 * distances to the planes accumulated into the quadric.
 */
export const QUADRIC_SIZE = 10;

/** a plane a·x + b·y + c·z + d = 0 with unit normal (a, b, c) */
export type PlaneEq = [number, number, number, number];

export class Quadrics {
  readonly q: Float64Array;

  constructor(count: number) {
    this.q = new Float64Array(count * QUADRIC_SIZE);
  }

  addPlane(v: number, [a, b, c, d]: PlaneEq, w: number): void {
    const q = this.q;
    const o = v * QUADRIC_SIZE;
    q[o] += w * a * a;
    q[o + 1] += w * a * b;
    q[o + 2] += w * a * c;
    q[o + 3] += w * a * d;
    q[o + 4] += w * b * b;
    q[o + 5] += w * b * c;
    q[o + 6] += w * b * d;
    q[o + 7] += w * c * c;
    q[o + 8] += w * c * d;
    q[o + 9] += w * d * d;
  }

  /** Q[into] += Q[from] */
  absorb(into: number, from: number): void {
    for (let k = 0; k < QUADRIC_SIZE; k++) this.q[into * QUADRIC_SIZE + k] += this.q[from * QUADRIC_SIZE + k];
  }

  /** Q[a] + Q[b] written into `out` */
  sum(a: number, b: number, out: Float64Array): Float64Array {
    for (let k = 0; k < QUADRIC_SIZE; k++) out[k] = this.q[a * QUADRIC_SIZE + k] + this.q[b * QUADRIC_SIZE + k];
    return out;
  }
}

/** the error of point (x, y, z) under quadric q */
export function quadricError(q: Float64Array, x: number, y: number, z: number): number {
  return (
    q[0] * x * x +
    2 * q[1] * x * y +
    2 * q[2] * x * z +
    2 * q[3] * x +
    q[4] * y * y +
    2 * q[5] * y * z +
    2 * q[6] * y +
    q[7] * z * z +
    2 * q[8] * z +
    q[9]
  );
}

/** the point minimising q (Cramer's rule on the 3×3 part), or null when the system is near singular */
export function optimalPoint(q: Float64Array): [number, number, number] | null {
  const [A, B, C, D, E, F] = [q[0], q[1], q[2], q[4], q[5], q[7]];
  const det = A * (D * F - E * E) - B * (B * F - E * C) + C * (B * E - D * C);
  const trace = A + D + F;
  if (!(Math.abs(det) > 1e-10 * trace * trace * trace)) return null;
  const [r0, r1, r2] = [-q[3], -q[6], -q[8]];
  const x = (r0 * (D * F - E * E) - B * (r1 * F - E * r2) + C * (r1 * E - D * r2)) / det;
  const y = (A * (r1 * F - E * r2) - r0 * (B * F - E * C) + C * (B * r2 - r1 * C)) / det;
  const z = (A * (D * r2 - r1 * E) - B * (B * r2 - r1 * C) + r0 * (B * E - D * C)) / det;
  return [x, y, z];
}
