import { describe, expect, it } from "vitest";
import { readStick } from "./stick-math";

describe("readStick", () => {
  it("does nothing inside the dead zone", () => {
    const r = readStick(3, -4, 50);
    expect([r.fwd, r.lr]).toEqual([0, 0]);
  });

  it("pushing up is forward, right is right", () => {
    expect(readStick(0, -50, 50).fwd).toBeCloseTo(1);
    expect(readStick(50, 0, 50).lr).toBeCloseTo(1);
    expect(readStick(0, 50, 50).fwd).toBeCloseTo(-1);
  });

  it("keeps the knob on the rim when the finger goes past it", () => {
    const r = readStick(0, -200, 50);
    expect(r.knobY).toBeCloseTo(-50);
    expect(r.fwd).toBeCloseTo(1);
  });

  it("grows smoothly from the edge of the dead zone", () => {
    expect(readStick(0, -10, 50).fwd).toBeGreaterThan(0);
    expect(readStick(0, -10, 50).fwd).toBeLessThan(0.1);
  });
});
