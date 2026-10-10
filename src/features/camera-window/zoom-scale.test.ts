import { describe, expect, it } from "vitest";
import { distanceToSlider, sliderToDistance } from "./zoom-scale";

describe("zoom slider", () => {
  it("runs from 300 m to 30 cm", () => {
    expect(sliderToDistance(0)).toBeCloseTo(300);
    expect(sliderToDistance(100)).toBeCloseTo(0.3);
    expect(sliderToDistance(50)).toBeCloseTo(Math.sqrt(300 * 0.3));
  });
  it("round-trips and clamps", () => {
    expect(distanceToSlider(sliderToDistance(37))).toBeCloseTo(37);
    expect(distanceToSlider(5000)).toBe(0);
    expect(distanceToSlider(0.01)).toBe(100);
  });
});
