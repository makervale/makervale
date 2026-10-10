import { describe, expect, it } from "vitest";
import { StepClock } from "./steps";

const walking = { speed: 1.5, onGround: true, flying: false, sitting: false };

function stepsIn(seconds: number, w = walking): number {
  const clock = new StepClock();
  let n = 0;
  for (let t = 0; t < seconds; t += 1 / 60) if (clock.advance(1 / 60, w)) n++;
  return n;
}

describe("StepClock", () => {
  it("steps about twice a second at walking speed", () => {
    expect(stepsIn(4)).toBeGreaterThanOrEqual(7);
    expect(stepsIn(4)).toBeLessThanOrEqual(9);
  });

  it("steps faster when running", () => {
    expect(stepsIn(4, { ...walking, speed: 4 })).toBeGreaterThan(stepsIn(4));
  });

  it("is silent standing, flying, sitting or in the air", () => {
    expect(stepsIn(2, { ...walking, speed: 0 })).toBe(0);
    expect(stepsIn(2, { ...walking, flying: true })).toBe(0);
    expect(stepsIn(2, { ...walking, sitting: true })).toBe(0);
    expect(stepsIn(2, { ...walking, onGround: false })).toBe(0);
  });
});
