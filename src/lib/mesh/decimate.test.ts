import { describe, expect, it } from "vitest";
import { length, sub } from "../vec";
import { decimate } from "./decimate";
import { genBox, genPlane, genSphere, genTorus } from "./generators";
import type { Mesh } from "./mesh";
import { signedVolume, triangleCount } from "./mesh";
import { HEALTHY, defects } from "./test-helpers";
import { topologyOf } from "./topology";
import { inspect } from "./validate";

const borderLength = (m: Mesh) => {
  let s = 0;
  for (const e of topologyOf(m).edges.values()) if (e.faces.length === 1) s += length(sub(m.v[e.a], m.v[e.b]));
  return s;
};

describe("decimate", () => {
  for (const [ratio, tol] of [
    [0.5, 0.1],
    [0.1, 0.25],
  ]) {
    it(`sphere at ${ratio} stays closed and keeps its volume`, () => {
      const m = genSphere(48);
      const v0 = signedVolume(m);
      const t0 = triangleCount(m);
      const r = decimate(m, ratio);
      expect(r.before).toBe(t0);
      expect(r.after).toBe(triangleCount(m));
      expect(r.after).toBeLessThanOrEqual(Math.ceil(t0 * ratio * 1.05));
      expect(defects(m)).toEqual(HEALTHY);
      expect(Math.abs(signedVolume(m) - v0) / v0).toBeLessThan(tol);
    });
  }
  it("torus at 0.25 stays closed", () => {
    const m = genTorus(32, 0.35);
    const v0 = signedVolume(m);
    const r = decimate(m, 0.25);
    expect(r.after).toBeLessThanOrEqual(Math.ceil(r.before * 0.25 * 1.05));
    expect(defects(m)).toEqual(HEALTHY);
    expect(Math.abs(signedVolume(m) - v0) / v0).toBeLessThan(0.15);
  });
  it("keeps material slots and their border", () => {
    const m = genBox(8);
    m.fm = m.f.map((p) => (p.every((i) => m.v[i][2] >= 0) ? 1 : 0));
    decimate(m, 0.15);
    expect(new Set(m.fm)).toEqual(new Set([0, 1]));
    expect(defects(m)).toEqual(HEALTHY);
    expect(signedVolume(m)).toBeCloseTo(1, 3);
    // the slot border stays on z = 0
    for (const e of topologyOf(m).edges.values()) {
      if (m.fm[e.faces[0]] === m.fm[e.faces[1]]) continue;
      expect(m.v[e.a][2]).toBeCloseTo(0, 6);
      expect(m.v[e.b][2]).toBeCloseTo(0, 6);
    }
  });
  it("flat box collapses to few quads", () => {
    const m = genBox(6);
    decimate(m, 0.05);
    expect(defects(m)).toEqual(HEALTHY);
    expect(signedVolume(m)).toBeCloseTo(1, 4);
    expect(m.f.some((p) => p.length === 4)).toBe(true);
  });
  for (const keepBoundary of [true, false]) {
    it(`open plane keeps its border (keepBoundary=${keepBoundary})`, () => {
      const m = genPlane(8);
      const l0 = borderLength(m);
      const r = decimate(m, 0.5, { keepBoundary });
      expect(r.after).toBeLessThan(r.before);
      expect(Math.abs(borderLength(m) - l0) / l0).toBeLessThan(0.02);
      const rep = inspect(m);
      expect(rep.nonManifold.length + rep.flipped.length + rep.degenerate.length).toBe(0);
      if (keepBoundary) expect(rep.open.length).toBe(32);
    });
  }
  it("ratio >= 1 is a no-op", () => {
    const m = genSphere(12);
    const f = m.f;
    decimate(m, 1);
    expect(m.f).toBe(f);
  });
  it("handles ~50k triangles quickly", () => {
    const m = genSphere(224);
    const t0 = performance.now();
    const r = decimate(m, 0.1);
    const dt = performance.now() - t0;
    expect(r.before).toBeGreaterThan(49000);
    expect(defects(m)).toEqual(HEALTHY);
    console.log(`decimate ${r.before} → ${r.after} tris in ${dt.toFixed(0)} ms`);
    expect(dt).toBeLessThan(3000); // ~1 s target; generous bound for slow CI
  });
});
