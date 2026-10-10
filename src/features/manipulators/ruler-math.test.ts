import { describe, expect, it } from "vitest";
import { rulerSubdivisions, rulerTicks, snapTo } from "./ruler-math";

describe("ruler math", () => {
  it("divides the grid in powers of two as you zoom in", () => {
    // 1 m grid seen face on, 1 cm per pixel: 100 px per metre → 4 steps of 14+ px
    expect(rulerSubdivisions(1, 0.01, 1)).toBe(4);
    expect(rulerSubdivisions(1, 0.001, 1)).toBe(64);
  });
  it("stays within a quarter and 256 steps", () => {
    expect(rulerSubdivisions(1, 100, 1)).toBe(0.25);
    expect(rulerSubdivisions(1, 1e-9, 1)).toBe(256);
  });
  it("draws whole grid units as long ticks", () => {
    const ticks = rulerTicks(0, 1, 0.5, 1);
    expect(ticks.map((t) => t.along)).toEqual([-1, -0.5, 0, 0.5, 1]);
    expect(ticks.map((t) => t.px)).toEqual([12, 5, 12, 5, 12]);
  });
  it("gives up on rulers with too many ticks", () => {
    expect(rulerTicks(0, 1000, 0.001, 1)).toEqual([]);
  });
  it("snaps to steps", () => {
    expect(snapTo(0.74, 0.25)).toBe(0.75);
  });
});
