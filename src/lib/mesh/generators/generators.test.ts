import { describe, expect, it } from "vitest";
import { signedVolume } from "../mesh";
import { HEALTHY, defects } from "../test-helpers";
import { inspect } from "../validate";
import { genBox, genCone, genCylinder, genIcosphere, genPlane, genSphere, genStairs, genTorus, genTube } from "./index";

describe("generators", () => {
  const solids = {
    box: genBox(1),
    box3: genBox(3),
    cyl: genCylinder(24),
    cyl3: genCylinder(12, 3),
    cone: genCone(16),
    sph: genSphere(24),
    ico: genIcosphere(2),
    tor: genTorus(24),
    tube: genTube(16),
    stairs: genStairs(4),
  };
  for (const [name, m] of Object.entries(solids)) {
    it(`${name} is closed, consistent and outward`, () => {
      expect(defects(m)).toEqual(HEALTHY);
      expect(signedVolume(m)).toBeGreaterThan(0);
    });
  }
  it("box fills the unit cube", () => {
    expect(signedVolume(genBox(2))).toBeCloseTo(1, 6);
  });
  it("plane is open with 4 border edges per side", () => {
    const r = inspect(genPlane(2));
    expect(r.open.length).toBe(8);
    expect(r.flipped.length).toBe(0);
  });
});
