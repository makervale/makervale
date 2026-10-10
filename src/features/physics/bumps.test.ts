import { describe, expect, it } from "vitest";
import { bumpsOf } from "./bumps";

describe("bumpsOf", () => {
  it("tells when a ball starts touching something, however gently", () => {
    const bumps = bumpsOf();
    expect(bumps("ball", [{ id: "turf", speed: 0.05 }], 0)).toHaveLength(2);
    // rolling on: the same floor every step is not news
    expect(bumps("ball", [{ id: "turf", speed: 0.08 }], 0.01)).toEqual([]);
    // onto the goal's ground: news, even rolling slowly
    const into = bumps("ball", [{ id: "goal area", speed: 0.08 }], 0.02);
    expect(into.map((b) => [b.id, b.by])).toEqual([
      ["goal area", "ball"],
      ["ball", "goal area"],
    ]);
  });

  it("a hard knock counts while already touching, but not twice in a moment", () => {
    const bumps = bumpsOf();
    bumps("ball", [{ id: "wall", speed: 0.1 }], 0);
    expect(bumps("ball", [{ id: "wall", speed: 4 }], 0.5)).toHaveLength(2);
    expect(bumps("ball", [{ id: "wall", speed: 4 }], 0.6)).toEqual([]);
  });

  it("the ground (no object) is told only to the ball", () => {
    const bumps = bumpsOf();
    expect(bumps("ball", [{ id: null, speed: 3 }], 0)).toEqual([{ id: "ball", by: "ground", speed: 3 }]);
  });
});
