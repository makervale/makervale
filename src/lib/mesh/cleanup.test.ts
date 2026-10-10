import { describe, expect, it } from "vitest";
import { fromTriangles } from "./cleanup";
import { genBox, genCylinder } from "./generators";
import type { Mesh } from "./mesh";
import { signedVolume } from "./mesh";
import { limitedDissolve } from "./limited-dissolve";
import { triangulate } from "./ops/triangulate";
import { fixTJunctions } from "./t-junctions";
import { triangulatePoly } from "./triangulate";
import { inspect } from "./validate";

const closed = (m: Mesh) => {
  const r = inspect(m);
  return { open: r.open.length, nm: r.nonManifold.length, flipped: r.flipped.length };
};
const ok = { open: 0, nm: 0, flipped: 0 };

describe("cleanup", () => {
  it("triangulated box dissolves back to 6 quads", () => {
    const m = genBox(1);
    triangulate(m, new Set(m.f.keys()), triangulatePoly);
    expect(m.f.length).toBe(12);
    expect(limitedDissolve(m)).toBe(6);
    expect(m.f.length).toBe(6);
    expect(m.f.every((p) => p.length === 4)).toBe(true);
    expect(closed(m)).toEqual(ok);
  });
  it("subdivided box dissolves to 6 quads", () => {
    const m = genBox(3);
    limitedDissolve(m);
    expect(m.f.length).toBe(6);
    expect(m.v.length).toBe(8);
    expect(closed(m)).toEqual(ok);
    expect(signedVolume(m)).toBeCloseTo(1, 6);
  });
  it("cylinder sides stay separate", () => {
    const m = genCylinder(16);
    expect(limitedDissolve(m)).toBe(0);
    expect(m.f.length).toBe(18);
    expect(closed(m)).toEqual(ok);
  });
  it("fromTriangles welds a soup and fixes T-junctions", () => {
    // square split into 1 big triangle + 2 small ones meeting at the midpoint of the big one's edge
    const pos = [0, 0, 0, 1, 0, 0, 0, 1, 0, 1, 0, 0, 1, 1, 0, 0.5, 0.5, 0, 0.5, 0.5, 0, 1, 1, 0, 0, 1, 0];
    const m = fromTriangles(pos, null);
    expect(m.v.length).toBe(5);
    expect(m.f[0].length).toBe(4); // midpoint spliced into the diagonal
    expect(inspect(m).open.length).toBe(4);
    expect(fixTJunctions(m)).toBe(0);
    limitedDissolve(m);
    expect(m.f.length).toBe(1);
    expect(m.f[0].length).toBe(4);
  });
});
