import { expect } from "vitest";
import type { Vec3 } from "../vec";
import type { Mesh } from "./mesh";
import { faceNormal, signedVolume } from "./mesh";
import type { MeshReport } from "./validate";
import { topologyOf } from "./topology";
import { inspect } from "./validate";

/** Shared checks for the mesh tests (imported by *.test.ts only). */

/** the defect counts of a mesh; a healthy closed solid matches HEALTHY */
export function defects(m: Mesh): { open: number; nm: number; flipped: number; degenerate: number; loose: number } {
  const r = inspect(m);
  return {
    open: r.open.length,
    nm: r.nonManifold.length,
    flipped: r.flipped.length,
    degenerate: r.degenerate.length,
    loose: r.loose.length,
  };
}

export const HEALTHY = { open: 0, nm: 0, flipped: 0, degenerate: 0, loose: 0 };

/** consistent winding, manifold, and (when closed) shut with positive volume */
export function expectSane(m: Mesh, closed = true): MeshReport {
  const r = inspect(m);
  expect(r.flipped.length, "flipped").toBe(0);
  expect(r.nonManifold.length, "non-manifold").toBe(0);
  if (closed) {
    expect(r.open.length, "open").toBe(0);
    expect(signedVolume(m)).toBeGreaterThan(0);
  }
  return r;
}

/** faces whose normal points up */
export const topFaces = (m: Mesh): number[] => m.f.flatMap((face, i) => (faceNormal(m, face)[2] > 0.9 ? [i] : []));

/** the mesh with every vertex shifted by d */
export function moved(m: Mesh, d: Vec3): Mesh {
  for (const v of m.v) {
    v[0] += d[0];
    v[1] += d[1];
    v[2] += d[2];
  }
  return m;
}

/** an edge on the side of a box/cylinder running from bottom to top */
export const firstVerticalEdge = (m: Mesh): string => {
  for (const [k, e] of topologyOf(m).edges) {
    const a = m.v[e.a];
    const b = m.v[e.b];
    const vertical = Math.abs(a[2] - b[2]) > 0.05 && Math.hypot(a[0] - b[0], a[1] - b[1]) < 1e-6;
    if (vertical && Math.hypot(a[0], a[1]) > 0.3) return k;
  }
  throw new Error("none");
};
