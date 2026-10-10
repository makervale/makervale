import { describe, expect, it } from "vitest";
import { genBox, genPlane } from "../generators";
import { signedVolume } from "../mesh";
import { expectSane, topFaces } from "../test-helpers";
import { deleteFaces } from "./delete";
import { solidify } from "./solidify";

describe("solidify", () => {
  it("turns a plane into a closed slab of the right thickness", () => {
    const m = genPlane(2);
    for (const v of m.v) v[2] = 0;
    solidify(m, 0.1, [1, 1, 1]);
    expectSane(m);
    const zs = m.v.map((v) => v[2]);
    expect(Math.max(...zs) - Math.min(...zs)).toBeCloseTo(0.1, 5);
  });
  it("gives an open box walls", () => {
    const m = genBox(1);
    deleteFaces(m, new Set(topFaces(m)));
    solidify(m, 0.05, [1, 1, 1]);
    expectSane(m);
  });
  it("hollows a closed box", () => {
    const m = genBox(1);
    solidify(m, 0.1, [1, 1, 1]);
    const r = expectSane(m);
    expect(r.parts).toBe(2);
    expect(signedVolume(m)).toBeCloseTo(1 - 0.8 ** 3, 4);
  });
});
