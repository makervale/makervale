import { describe, expect, it } from "vitest";
import { cross, distance, normalize } from "./vec";

describe("vec", () => {
  it("cross product follows the right-hand rule", () => {
    expect(cross([1, 0, 0], [0, 1, 0])).toEqual([0, 0, 1]);
  });
  it("normalizes and measures", () => {
    const n = normalize([0, 3, 4]);
    expect(n[1]).toBeCloseTo(0.6);
    expect(n[2]).toBeCloseTo(0.8);
    expect(distance([0, 0, 0], [1, 2, 2])).toBe(3);
    expect(normalize([0, 0, 0])).toEqual([0, 0, 0]);
  });
});

import { rotate } from "./vec";

describe("quaternion rotate", () => {
  it("turns +X into +Y for a 90° turn about Z", () => {
    const halfTurn = Math.SQRT1_2;
    const r = rotate([1, 0, 0], [0, 0, halfTurn, halfTurn]);
    expect(r[0]).toBeCloseTo(0);
    expect(r[1]).toBeCloseTo(1);
    expect(r[2]).toBeCloseTo(0);
  });
});
