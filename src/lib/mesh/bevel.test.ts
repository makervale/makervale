import { describe, expect, it } from "vitest";
import type { Vec3 } from "../vec";
import { bevel } from "./bevel";
import { genBox, genCylinder } from "./generators";
import type { Mesh } from "./mesh";
import { cloneMesh, edgeKey, signedVolume } from "./mesh";
import { topologyOf } from "./topology";
import { inspect } from "./validate";

const solid = (m: Mesh) => {
  const r = inspect(m);
  expect(r.open.length).toBe(0);
  expect(r.nonManifold.length).toBe(0);
  expect(r.flipped.length).toBe(0);
  expect(r.degenerate.length).toBe(0);
  expect(r.loose.length).toBe(0);
  expect(r.closed).toBe(true);
  expect(signedVolume(m)).toBeGreaterThan(0);
  return r;
};
/** edges whose endpoints both satisfy the predicate */
const edgesWhere = (m: Mesh, pred: (a: Vec3, b: Vec3) => boolean) => {
  const out = new Set<string>();
  for (const [k, e] of topologyOf(m).edges) if (pred(m.v[e.a], m.v[e.b])) out.add(k);
  return out;
};
const near = (x: number, y: number) => Math.abs(x - y) < 1e-6;
const topEdges = (m: Mesh) =>
  edgesWhere(
    m,
    (a, b) =>
      near(a[2], 0.5) &&
      near(b[2], 0.5) &&
      ((near(Math.abs(a[0]), 0.5) && near(a[0], b[0])) || (near(Math.abs(a[1]), 0.5) && near(a[1], b[1]))),
  );
const oneTopEdge = (m: Mesh) =>
  new Set([
    [...edgesWhere(m, (a, b) => near(a[2], 0.5) && near(b[2], 0.5) && near(a[1], -0.5) && near(b[1], -0.5))][0],
  ]);
const allEdges = (m: Mesh) => new Set(topologyOf(m).edges.keys());

describe("bevel", () => {
  it("one cube edge: one strip, two side faces become pentagons", () => {
    const m = genBox(1);
    const s = bevel(m, oneTopEdge(m), 0.1);
    const r = solid(m);
    expect(r.faces).toBe(7);
    expect(s.faces.size).toBe(1);
    expect(r.ngons.length).toBe(2);
    expect(r.verts).toBe(10);
    expect(m.f[[...s.faces][0]].length).toBe(4);
  });
  it("one cube edge rounded", () => {
    const m = genBox(1);
    const s = bevel(m, oneTopEdge(m), 0.1, 4);
    const r = solid(m);
    expect(r.faces).toBe(10);
    expect(s.faces.size).toBe(4);
    // a 90° fillet is an exact circular arc of radius w around the axis (y, z) = (-0.4, 0.4)
    for (const f of s.faces)
      for (const i of m.f[f]) expect(Math.hypot(m.v[i][1] + 0.4, m.v[i][2] - 0.4)).toBeCloseTo(0.1, 9);
  });
  for (const n of [1, 3]) {
    it(`top loop of a cube, ${n} segment(s)`, () => {
      const m = genBox(1);
      const s = bevel(m, topEdges(m), 0.1, n);
      const r = solid(m);
      expect(r.faces).toBe(6 + 4 * n);
      expect(s.faces.size).toBe(4 * n);
    });
  }
  it("all 12 cube edges, chamfer: 6 + 12 + 8 faces", () => {
    const m = genBox(1);
    const s = bevel(m, allEdges(m), 0.1);
    const r = solid(m);
    expect(r.faces).toBe(26);
    expect(s.faces.size).toBe(20);
    expect(r.tris).toBe(6 * 2 + 12 * 2 + 8);
    expect(m.f.filter((p) => p.length === 3).length).toBe(8);
  });
  it("all 12 cube edges, 3 segments (corner caps fanned)", () => {
    const m = genBox(1);
    const s = bevel(m, allEdges(m), 0.1, 3);
    const r = solid(m);
    expect(r.faces).toBe(6 + 36 + 8 * 9);
    expect(s.faces.size).toBe(36 + 72);
    // the rounded corner bulges out past the chamfer
    const c = genBox(1);
    bevel(c, allEdges(c), 0.1);
    expect(signedVolume(m)).toBeGreaterThan(signedVolume(c));
  });
  it("cylinder top rim, 2 segments", () => {
    const m = genCylinder(16, 1);
    const top = m.f.length - 2;
    const p = m.f[top];
    const rim = new Set(p.map((v, k) => edgeKey(v, p[(k + 1) % p.length])));
    const before = signedVolume(m);
    const s = bevel(m, rim, 0.05, 2);
    const r = solid(m);
    expect(r.faces).toBe(18 + 32);
    expect(s.faces.size).toBe(32);
    expect(signedVolume(m)).toBeLessThan(before);
    expect(m.f[top].length).toBe(16);
  });
  it("subdivided box: one edge between 4-valent vertices gets triangle caps", () => {
    const m = genBox(2);
    const isCentreToFront = (a: Vec3, b: Vec3) => near(a[0], 0) && near(a[1], 0) && near(b[0], 0) && near(b[1], -0.5);
    const k = [
      ...edgesWhere(
        m,
        (a, b) => near(a[2], 0.5) && near(b[2], 0.5) && (isCentreToFront(a, b) || isCentreToFront(b, a)),
      ),
    ];
    expect(k.length).toBe(1);
    for (const n of [1, 2, 3]) {
      const c = cloneMesh(m);
      const s = bevel(c, new Set(k), 0.05, n);
      const r = solid(c);
      expect(s.faces.size).toBe(n + (n >= 3 ? 2 * (2 + n) : 2));
      expect(r.faces).toBe(24 + s.faces.size);
    }
  });
  it("subdivided box: loop around the middle", () => {
    for (const n of [1, 3]) {
      const m = genBox(2);
      const loop = edgesWhere(m, (a, b) => near(a[2], 0) && near(b[2], 0));
      expect(loop.size).toBe(8);
      const s = bevel(m, loop, 0.1, n);
      const r = solid(m);
      expect(r.faces).toBe(24 + 8 * n);
      expect(s.faces.size).toBe(8 * n);
    }
  });
  it("width is in world metres (object scaled 2x)", () => {
    const m = genBox(1);
    const size: Vec3 = [2, 2, 2];
    const s = bevel(m, oneTopEdge(m), 0.1, 1, size);
    solid(m);
    const q = m.f[[...s.faces][0]].map((i) => m.v[i].map((x, k) => x * size[k]) as Vec3);
    const d = q.map((p, k) => Math.hypot(...(p.map((x, j) => x - q[(k + 1) % 4][j]) as Vec3))).sort((a, b) => a - b);
    expect(d[0]).toBeCloseTo(0.1 * Math.SQRT2, 6);
    expect(d[1]).toBeCloseTo(0.1 * Math.SQRT2, 6);
    expect(d[3]).toBeCloseTo(2, 6);
    expect(signedVolume(m) * 8).toBeCloseTo(8 - ((0.1 * 0.1) / 2) * 2, 6); // a prism of cross-section w²/2 is cut off
  });
  it("anisotropic size keeps a uniform world width", () => {
    const m = genBox(1);
    const size: Vec3 = [4, 1, 0.5];
    const s = bevel(m, topEdges(m), 0.1, 1, size);
    solid(m);
    // every strip point lies either on the top at 0.1 from a side, or on a side 0.1 below the top
    for (const f of s.faces) {
      for (const i of m.f[f]) {
        const p = m.v[i].map((x, k) => x * size[k]);
        const dz = size[2] / 2 - p[2];
        const ds = Math.min(size[0] / 2 - Math.abs(p[0]), size[1] / 2 - Math.abs(p[1]));
        expect((near(dz, 0) && Math.abs(ds - 0.1) < 1e-9) || (Math.abs(dz - 0.1) < 1e-9 && near(ds, 0))).toBe(true);
      }
    }
  });
  it("volume decreases", () => {
    const m = genBox(1);
    const before = signedVolume(m);
    bevel(m, allEdges(m), 0.1, 2);
    solid(m);
    expect(signedVolume(m)).toBeLessThan(before);
  });
  it("ignores open edges and returns an empty selection", () => {
    const m = genBox(1);
    const n = m.f.length;
    const s = bevel(m, new Set(["0_999"]), 0.1);
    expect(s.faces.size).toBe(0);
    expect(m.f.length).toBe(n);
  });
});
