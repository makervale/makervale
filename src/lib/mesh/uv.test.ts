import { describe, expect, it } from "vitest";
import type { Vec3 } from "../vec";
import { dot } from "../vec";
import { genBox, genCone, genCylinder, genIcosphere, genSphere, genStairs, genTorus } from "./generators";
import type { Mesh, UV } from "./mesh";
import { faceNormal } from "./mesh";
import { topologyOf } from "./topology";
import { boxUV, cylinderUV, faceSignature, reverseUV, smartUV, uvSegments, uvStretch, uvValid } from "./uv";

const uvOf = (m: Mesh) => m.uv!;
const inUnit = (m: Mesh) =>
  uvOf(m).every((q) => q.every(([u, v]) => u >= -1e-9 && u <= 1 + 1e-9 && v >= -1e-9 && v <= 1 + 1e-9));
const span = (q: UV[], k: 0 | 1) => Math.max(...q.map((p) => p[k])) - Math.min(...q.map((p) => p[k]));

type Tri = [UV, UV, UV];

/** grid cells whose centre lies strictly inside the triangle */
function cellsInside([A, B, C]: Tri, N: number): number[] {
  const d = (B[0] - A[0]) * (C[1] - A[1]) - (B[1] - A[1]) * (C[0] - A[0]);
  if (Math.abs(d) < 1e-14) return [];
  const x0 = Math.max(0, Math.floor(Math.min(A[0], B[0], C[0]) * N));
  const x1 = Math.min(N - 1, Math.ceil(Math.max(A[0], B[0], C[0]) * N));
  const y0 = Math.max(0, Math.floor(Math.min(A[1], B[1], C[1]) * N));
  const y1 = Math.min(N - 1, Math.ceil(Math.max(A[1], B[1], C[1]) * N));
  const out: number[] = [];
  for (let y = y0; y <= y1; y++) {
    for (let x = x0; x <= x1; x++) {
      const px = (x + 0.5) / N;
      const py = (y + 0.5) / N;
      const w1 = ((B[0] - px) * (C[1] - py) - (B[1] - py) * (C[0] - px)) / d;
      const w2 = ((C[0] - px) * (A[1] - py) - (C[1] - py) * (A[0] - px)) / d;
      const w3 = 1 - w1 - w2;
      if (w1 > 1e-9 && w2 > 1e-9 && w3 > 1e-9) out.push(y * N + x);
    }
  }
  return out;
}

/** rasterise every face (fan triangles, cell centres strictly inside) on an N² grid; count cells claimed by two faces */
function overlapCells(m: Mesh, N = 256): number {
  const owner = new Int32Array(N * N).fill(-1);
  let bad = 0;
  uvOf(m).forEach((q, fi) => {
    for (let i = 1; i < q.length - 1; i++) {
      for (const c of cellsInside([q[0], q[i], q[i + 1]], N)) {
        if (owner[c] >= 0 && owner[c] !== fi) bad++;
        owner[c] = fi;
      }
    }
  });
  return bad;
}
/** every face keeps its outside-CCW winding in UV (positive signed area) */
const allCCW = (m: Mesh) =>
  uvOf(m).every((q) => {
    let s = 0;
    for (let k = 0; k < q.length; k++) {
      const [a, b] = [q[k], q[(k + 1) % q.length]];
      s += a[0] * b[1] - a[1] * b[0];
    }
    return s > -1e-12;
  });

describe("smartUV", () => {
  it("box: 6 charts, unit square, no overlap, uniform density", () => {
    const m = genBox(1);
    expect(smartUV(m)).toBe(6);
    expect(uvValid(m)).toBe(true);
    expect(inUnit(m)).toBe(true);
    expect(overlapCells(m)).toBe(0);
    expect(allCCW(m)).toBe(true);
    expect(uvStretch(m, [1, 1, 1])).toBeLessThan(1e-6);
  });
  it("subdivided box still gives 6 charts", () => {
    const m = genBox(3);
    expect(smartUV(m)).toBe(6);
    expect(overlapCells(m)).toBe(0);
  });
  const shapes: Record<string, () => Mesh> = {
    sphere: () => genSphere(16),
    torus: () => genTorus(24),
    cylinder: () => genCylinder(24),
    cone: () => genCone(16),
    ico: () => genIcosphere(2),
    stairs: () => genStairs(4),
  };
  for (const [name, gen] of Object.entries(shapes)) {
    it(`${name}: valid, inside [0,1], no overlap`, () => {
      const m = gen();
      expect(smartUV(m)).toBeGreaterThan(1);
      expect(uvValid(m)).toBe(true);
      expect(inUnit(m)).toBe(true);
      expect(overlapCells(m)).toBeLessThanOrEqual(2);
      expect(allCCW(m)).toBe(true);
      expect(uvStretch(m, [1, 1, 1])).toBeLessThan(0.5);
    });
  }
  it("layout uses the square reasonably", () => {
    const m = genSphere(16);
    smartUV(m);
    let u1 = 0;
    let v1 = 0;
    for (const q of uvOf(m)) {
      for (const [u, v] of q) {
        u1 = Math.max(u1, u);
        v1 = Math.max(v1, v);
      }
    }
    expect(Math.max(u1, v1)).toBeGreaterThan(0.95);
  });
  it("size scaling: a 4×1×1 box gets 4:1 charts on its long sides", () => {
    const m = genBox(1);
    const size: Vec3 = [4, 1, 1];
    smartUV(m, size);
    // the y = -0.5 side spans x × z
    const long = m.f.map((_, i) => i).filter((i) => m.f[i].every((v) => Math.abs(m.v[v][1] + 0.5) < 1e-9))[0];
    const q = uvOf(m)[long];
    const [a, b] = [span(q, 0), span(q, 1)];
    expect(Math.max(a, b) / Math.min(a, b)).toBeCloseTo(4, 2);
    expect(uvStretch(m, size)).toBeLessThan(1e-6);
    expect(overlapCells(m)).toBe(0);
  });
  it("margin keeps charts apart", () => {
    const m = genBox(1);
    smartUV(m, [1, 1, 1], 66, 0.05);
    let lo = Infinity;
    for (const x of uvSegments(m)) lo = Math.min(lo, x);
    expect(lo).toBeGreaterThanOrEqual(0.05 - 1e-9);
  });
});

describe("boxUV / cylinderUV", () => {
  it("boxUV is in metres", () => {
    const m = genBox(1);
    boxUV(m, [2, 2, 2]);
    expect(uvValid(m)).toBe(true);
    for (const q of uvOf(m)) {
      expect(span(q, 0)).toBeCloseTo(2, 9);
      expect(span(q, 1)).toBeCloseTo(2, 9);
    }
    expect(allCCW(m)).toBe(true);
  });
  it("cylinderUV wraps once around", () => {
    const m = genCylinder(16);
    cylinderUV(m);
    expect(uvValid(m)).toBe(true);
    const side = m.f.map((_, i) => i).filter((i) => m.f[i].length === 4);
    expect(side.length).toBe(16);
    for (const i of side) {
      const s = span(uvOf(m)[i], 0);
      expect(s).toBeCloseTo(1 / 16, 9);
      expect(s).toBeLessThanOrEqual(0.5);
      expect(span(uvOf(m)[i], 1)).toBeCloseTo(1, 9);
    }
    expect(allCCW(m)).toBe(true);
    expect(inUnit(m)).toBe(true);
  });
  it("cylinderUV on a cone apex does not wrap", () => {
    const m = genCone(8);
    cylinderUV(m);
    for (const q of uvOf(m)) if (q.length === 3) expect(span(q, 0)).toBeLessThan(0.2);
  });
});

describe("diagnostics", () => {
  it("uvValid rejects missing / misaligned uv", () => {
    const m = genBox(1);
    expect(uvValid(m)).toBe(false);
    boxUV(m);
    expect(uvValid(m)).toBe(true);
    uvOf(m)[0].pop();
    expect(uvValid(m)).toBe(false);
    boxUV(m);
    uvOf(m).pop();
    expect(uvValid(m)).toBe(false);
  });
  it("outline is deduplicated", () => {
    const m = genBox(1);
    smartUV(m);
    expect(uvSegments(m).length).toBe(24 * 4); // 6 separate squares
    const c = genCylinder(8);
    cylinderUV(c);
    // strip: verticals (+1 at the seam), bottom, top; both caps project onto the same octagon
    expect(uvSegments(c).length).toBe((8 + 1 + 8 + 8 + 8) * 4);
  });
  it("faceSignature tracks topology only", () => {
    const m = genBox(1);
    const s0 = faceSignature(m);
    m.v[0][0] += 0.1;
    expect(faceSignature(m)).toBe(s0);
    m.f[0].reverse();
    expect(faceSignature(m)).not.toBe(s0);
    m.f[0].reverse();
    expect(faceSignature(m)).toBe(s0);
    const n = genBox(1);
    n.f[2] = [n.f[2][1], n.f[2][2], n.f[2][3], n.f[2][0]];
    expect(faceSignature(n)).not.toBe(s0);
  });
  it("reverseUV keeps corners aligned with a reversed face", () => {
    const m = genBox(1);
    boxUV(m, [1, 1, 1]);
    const before = uvOf(m)[3].map((q) => [...q]);
    const vs = m.f[3].slice();
    m.f[3].reverse();
    reverseUV(m, 3);
    m.f[3].forEach((v, k) => expect(uvOf(m)[3][k]).toEqual(before[vs.indexOf(v)]));
    const n = genBox(1);
    expect(() => reverseUV(n, 0)).not.toThrow();
  });
  it("charts never span normals beyond the angle limit", () => {
    // two faces whose shared edge has identical UVs on both sides are in one chart: their normals must be within the limit
    for (const m of [genTorus(24, 0.35), genSphere(16), genStairs(4), genCylinder(24)]) {
      smartUV(m, [1, 1, 1], 40);
      const uv = uvOf(m);
      const cosA = Math.cos((40 * Math.PI) / 180);
      let joined = 0;
      let edges = 0;
      for (const e of topologyOf(m).edges.values()) {
        if (e.faces.length !== 2) continue;
        const [f, g] = e.faces;
        const nn = dot(faceNormal(m, m.f[f]), faceNormal(m, m.f[g]));
        if (nn > 0.9999) edges++;
        const at = (fi: number, v: number) => uv[fi][m.f[fi].indexOf(v)];
        const same = [e.a, e.b].every((v) => {
          const [p, q] = [at(f, v), at(g, v)];
          return Math.abs(p[0] - q[0]) + Math.abs(p[1] - q[1]) < 1e-12;
        });
        if (!same) continue;
        joined++;
        expect(nn).toBeGreaterThanOrEqual(cosA - 1e-9);
      }
      expect(joined).toBeGreaterThanOrEqual(edges); // coplanar neighbours always share a chart
      expect(allCCW(m)).toBe(true);
    }
  });
  it("uvStretch detects distortion", () => {
    const m = genBox(1);
    boxUV(m, [1, 1, 1]);
    expect(uvStretch(m, [3, 1, 1])).toBeGreaterThan(0.1);
  });
});
