import { describe, expect, it } from "vitest";
import { INNER_RADIUS, labelBox, outerRadius, pieCentre, slotCount, wedgePath } from "./geometry";

describe("pie geometry", () => {
  it("has at least six slots and grows past eight items", () => {
    expect(slotCount(3)).toBe(6);
    expect(slotCount(9)).toBe(9);
    expect(outerRadius(8)).toBe(136);
    expect(outerRadius(9)).toBe(152);
  });

  it("starts the first wedge straight up, centred on the label", () => {
    const path = wedgePath(0, 4, 100);
    const [x0] = path.slice(1).split(" ").map(Number);
    expect(x0).toBeLessThan(0);
    expect(path).toContain(`A100 100 0 0 1`);
    expect(path).toContain(`A${INNER_RADIUS} ${INNER_RADIUS} 0 0 0`);
    const top = labelBox(0, 4, 100);
    expect(top.left).toBeCloseTo(0, 5);
    expect(top.top).toBeLessThan(0);
  });

  it("makes labels narrower at the top than at the sides", () => {
    const top = labelBox(0, 8, 136);
    const side = labelBox(2, 8, 136);
    expect(top.width).toBeLessThan(side.width);
    expect(top.width).toBeGreaterThanOrEqual(58);
    expect(side.width).toBeLessThanOrEqual(112);
  });

  it("keeps the pie inside the stage", () => {
    const stage = { width: 800, height: 600 };
    expect(pieCentre(400, 300, stage, 6)).toEqual({ left: 400, top: 300 });
    expect(pieCentre(0, 0, stage, 6)).toEqual({ left: 190, top: 140 });
    expect(pieCentre(800, 600, stage, 6)).toEqual({ left: 610, top: 426 });
  });
});
