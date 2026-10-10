import { describe, expect, it } from "vitest";
import { genBox, genCylinder, genSphere } from "../generators";
import { signedVolume } from "../mesh";
import { expectSane, topFaces } from "../test-helpers";
import { bisect } from "./bisect";

describe("bisect", () => {
  it("cuts a sphere and caps it", () => {
    const m = genSphere(16);
    const v0 = signedVolume(m);
    bisect(m, null, { p: [0, 0, 0.1], n: [0, 0, 1] }, { remove: "front", fill: true });
    expectSane(m);
    expect(signedVolume(m)).toBeLessThan(v0);
    expect(signedVolume(m)).toBeGreaterThan(v0 * 0.5);
    for (const v of m.v) expect(v[2]).toBeLessThanOrEqual(0.1 + 1e-6);
  });
  it("cuts a box diagonally and keeps both halves joined", () => {
    const m = genBox(1);
    const s = bisect(m, null, { p: [0, 0, 0], n: [Math.SQRT1_2, Math.SQRT1_2, 0] });
    expectSane(m);
    expect(m.f.length).toBe(8);
    expect(s.edges.size).toBe(2);
    expect(signedVolume(m)).toBeCloseTo(1, 6);
  });
  it("cuts a cylinder", () => {
    const m = genCylinder(12, 1);
    bisect(m, null, { p: [0, 0, 0.2], n: [0.2, 0, 1] });
    expectSane(m);
  });
  it("cuts only selected faces of a box", () => {
    const m = genBox(1);
    bisect(m, new Set(topFaces(m)), { p: [0, 0, 0], n: [1, 0, 0] });
    expectSane(m);
    expect(m.f.length).toBe(7);
  });
});
