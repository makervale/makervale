import { describe, expect, it } from "vitest";
import { genPlane } from "../generators";
import type { Mesh } from "../mesh";
import { signedVolume } from "../mesh";
import { expectSane } from "../test-helpers";
import { topologyOf } from "../topology";
import type { Sweep } from "./spin";
import { spin } from "./spin";

const aroundZ = (angleDeg: number, steps: number): Sweep => ({ axis: { p: [0, 0, 0], d: [0, 0, 1] }, angleDeg, steps });

describe("spin", () => {
  const profile = (): Mesh => ({
    v: [
      [0.2, 0, -0.2],
      [0.4, 0, -0.2],
      [0.4, 0, 0.2],
      [0.2, 0, 0.2],
    ],
    f: [[0, 1, 2, 3]],
    fm: [0],
  });
  it("revolves a face 360° into a closed ring", () => {
    const m = profile();
    spin(m, new Set([0]), new Set(), aroundZ(360, 16), [1, 1, 1]);
    const r = expectSane(m);
    expect(r.parts).toBe(1);
    expect(m.f.length).toBe(64);
  });
  it("revolves a face 90° into a closed piece with caps", () => {
    const m = profile();
    spin(m, new Set([0]), new Set(), aroundZ(90, 4), [1, 1, 1]);
    expectSane(m);
  });
  it("revolves an open profile touching the axis", () => {
    const m: Mesh = {
      v: [
        [0, 0, -0.3],
        [0.3, 0, -0.3],
        [0.3, 0, 0.3],
        [0, 0, 0.3],
      ],
      f: [[0, 1, 2, 3]],
      fm: [0],
    };
    spin(m, new Set([0]), new Set(), aroundZ(360, 12), [1, 1, 1]);
    expectSane(m);
    expect(signedVolume(m)).toBeGreaterThan(0.15);
  });
  it("revolves boundary edges into a surface", () => {
    const m = genPlane(1);
    for (const v of m.v) {
      v[2] = v[1];
      v[1] = 0;
      v[0] += 0.8;
    }
    const near = (x: number): boolean => Math.abs(x - 1.3) < 1e-6;
    const k = [...topologyOf(m).edges].find(([, e]) => near(m.v[e.a][0]) && near(m.v[e.b][0]))![0];
    spin(m, new Set(), new Set([k]), aroundZ(90, 6), [1, 1, 1]);
    expectSane(m, false);
  });
});
