/** Modelling helpers for the start scene. Everything is in metres; `place` fits each shape into unit space. */
import { bevel } from "@/lib/mesh/bevel";
import * as G from "@/lib/mesh/generators";
import type { Mesh } from "@/lib/mesh/mesh";
import { faceCenter, faceNormal } from "@/lib/mesh/mesh";
import { append } from "@/lib/mesh/ops/append";
import { spin } from "@/lib/mesh/ops/spin";
import { sharpEdges } from "@/lib/mesh/select-similar";
import type { Vec3 } from "@/lib/vec";

export const ONE: Vec3 = [1, 1, 1];
const UP: Vec3 = [0, 0, 1];

export type Profile = [number, number][];

/** box of `size` centred on (at[0], at[1]) standing on at[2] */
export function box(size: Vec3, at: Vec3 = [0, 0, 0]): Mesh {
  const m = G.genBox(1);
  for (const v of m.v) {
    v[0] = v[0] * size[0] + at[0];
    v[1] = v[1] * size[1] + at[1];
    v[2] = (v[2] + 0.5) * size[2] + at[2];
  }
  return m;
}

/** Spin: one face revolved around `axis` through the origin */
export function revolve(points: Vec3[], axis: Vec3, angleDeg: number, steps: number): Mesh {
  const m: Mesh = { v: points, f: [points.map((_, i) => i)], fm: [0] };
  spin(m, new Set([0]), new Set(), { axis: { p: [0, 0, 0], d: axis }, angleDeg, steps }, ONE);
  return m;
}

/** Spin (lathe): a profile of (radius, height) points revolved 360° around Z */
export const lathe = (profile: Profile, steps = 24): Mesh =>
  revolve(
    profile.map(([r, z]): Vec3 => [r, 0, z]),
    UP,
    360,
    steps,
  );

export function move(m: Mesh, d: Vec3): Mesh {
  for (const v of m.v) for (let k = 0; k < 3; k++) v[k] += d[k];
  return m;
}

export function scale(m: Mesh, s: Vec3): Mesh {
  for (const v of m.v) for (let k = 0; k < 3; k++) v[k] *= s[k];
  return m;
}

export function rotZ(m: Mesh, deg: number): Mesh {
  const a = (deg * Math.PI) / 180;
  const [c, s] = [Math.cos(a), Math.sin(a)];
  for (const v of m.v) {
    const [x, y] = v;
    v[0] = x * c - y * s;
    v[1] = x * s + y * c;
  }
  return m;
}

/** parts become one mesh; the number is each part's material slot */
export function join(...parts: [Mesh, number][]): Mesh {
  const m: Mesh = { v: [], f: [], fm: [] };
  for (const [p, slot] of parts) append(m, p, slot);
  return m;
}

export const facesWhere = (m: Mesh, pred: (n: Vec3, c: Vec3) => boolean): Set<number> =>
  new Set(m.f.map((_, i) => i).filter((i) => pred(faceNormal(m, m.f[i]), faceCenter(m, m.f[i]))));

/** the highest face pointing up */
export function topFace(m: Mesh): number {
  let best = -1;
  let z = -Infinity;
  m.f.forEach((p, i) => {
    const c = faceCenter(m, p);
    if (faceNormal(m, p)[2] > 0.9 && c[2] > z) {
      z = c[2];
      best = i;
    }
  });
  return best;
}

/** Bevel: every edge sharper than `ang` degrees */
export function bevelSharp(m: Mesh, w: number, seg = 1, ang = 60): Mesh {
  bevel(m, sharpEdges(m, ang, ONE), w, seg, ONE);
  return m;
}

/** deterministic noise so the scene is the same every time */
export function rng(seed: number): () => number {
  let s = seed >>> 0 || 1;
  return () => {
    s = Math.imul(s ^ (s >>> 15), 2246822519) ^ Math.imul(s ^ (s >>> 13), 3266489917);
    return (s >>> 0) / 4294967296;
  };
}

export function jitter(m: Mesh, amount: number, seed: number): Mesh {
  const random = rng(seed);
  for (const v of m.v) {
    const k = 1 + (random() - 0.5) * 2 * amount;
    for (let i = 0; i < 3; i++) v[i] *= k;
  }
  return m;
}

/** a flat disc of radius r and thickness h standing on z = 0 */
export const disc = (r: number, h: number): Mesh => scale(move(G.genCylinder(40), [0, 0, 0.5]), [2 * r, 2 * r, h]);
