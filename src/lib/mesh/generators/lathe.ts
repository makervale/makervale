import type { Vec3 } from "../../vec";
import type { Mesh } from "../mesh";

/** Solids built from horizontal rings of vertices around the Z axis. */
export function ring(seg: number, r: number, z: number): Vec3[] {
  const out: Vec3[] = [];
  for (let i = 0; i < seg; i++) {
    const a = (i / seg) * Math.PI * 2;
    out.push([Math.cos(a) * r, Math.sin(a) * r, z]);
  }
  return out;
}

const indices = (n: number): number[] => [...Array(n).keys()];

/** quads between ring `lower` (first vertex index) and the ring `n` vertices later */
function wallQuads(m: Mesh, lower: number, n: number): void {
  for (let i = 0; i < n; i++) {
    const j = (i + 1) % n;
    m.f.push([lower + i, lower + j, lower + n + j, lower + n + i]);
    m.fm.push(0);
  }
}

export function genCylinder(seg = 24, rings = 1): Mesh {
  const n = Math.max(3, seg | 0);
  const r = Math.max(1, rings | 0);
  const m: Mesh = { v: [], f: [], fm: [] };
  for (let k = 0; k <= r; k++) m.v.push(...ring(n, 0.5, -0.5 + k / r));
  for (let k = 0; k < r; k++) wallQuads(m, k * n, n);
  m.f.push(indices(n).map((i) => r * n + i));
  m.f.push(indices(n).reverse());
  m.fm.push(0, 0);
  return m;
}

export function genCone(seg = 24): Mesh {
  const n = Math.max(3, seg | 0);
  const m: Mesh = { v: ring(n, 0.5, -0.5), f: [], fm: [] };
  m.v.push([0, 0, 0.5]);
  for (let i = 0; i < n; i++) {
    m.f.push([i, (i + 1) % n, n]);
    m.fm.push(0);
  }
  m.f.push(indices(n).reverse());
  m.fm.push(0);
  return m;
}

export function genSphere(seg = 24): Mesh {
  const n = Math.max(3, seg | 0);
  const rings = Math.max(2, Math.round(n / 2));
  const m: Mesh = { v: [[0, 0, -0.5]], f: [], fm: [] };
  for (let k = 1; k < rings; k++) {
    const phi = -Math.PI / 2 + (Math.PI * k) / rings;
    m.v.push(...ring(n, Math.cos(phi) * 0.5, Math.sin(phi) * 0.5));
  }
  m.v.push([0, 0, 0.5]);
  const top = m.v.length - 1;
  const first = (k: number): number => 1 + (k - 1) * n;
  for (let i = 0; i < n; i++) {
    m.f.push([0, first(1) + ((i + 1) % n), first(1) + i]);
    m.fm.push(0);
  }
  for (let k = 1; k < rings - 1; k++) wallQuads(m, first(k), n);
  for (let i = 0; i < n; i++) {
    m.f.push([first(rings - 1) + i, first(rings - 1) + ((i + 1) % n), top]);
    m.fm.push(0);
  }
  return m;
}

export function genTube(seg = 24, wall = 0.2): Mesh {
  const n = Math.max(3, seg | 0);
  const inner = 0.5 * (1 - Math.min(0.95, Math.max(0.02, wall)));
  const m: Mesh = {
    v: [...ring(n, 0.5, -0.5), ...ring(n, 0.5, 0.5), ...ring(n, inner, -0.5), ...ring(n, inner, 0.5)],
    f: [],
    fm: [],
  };
  const [o0, o1, i0, i1] = [0, n, 2 * n, 3 * n];
  for (let i = 0; i < n; i++) {
    const j = (i + 1) % n;
    m.f.push([o0 + i, o0 + j, o1 + j, o1 + i]);
    m.f.push([i0 + j, i0 + i, i1 + i, i1 + j]);
    m.f.push([o1 + i, o1 + j, i1 + j, i1 + i]);
    m.f.push([o0 + j, o0 + i, i0 + i, i0 + j]);
    m.fm.push(0, 0, 0, 0);
  }
  return m;
}
