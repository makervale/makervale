import { describe, expect, it } from "vitest";
import * as THREE from "three";
import { clearView } from "./clear-view";

const centre = new THREE.Vector3();
const fromX = new THREE.Vector3(1, 0, 0);

describe("clearView", () => {
  it("keeps the direction when nothing is in the way", () => {
    const v = clearView(centre, fromX, 5, () => null);
    expect(v.direction.x).toBeCloseTo(1);
    expect(v.distance).toBe(5);
  });

  it("goes round to a clear side when a wall blocks the view", () => {
    // a wall on the +x side only
    const v = clearView(centre, fromX, 5, (_f, dir) => (dir.x > 0.5 ? 1 : null));
    expect(v.direction.x).toBeLessThanOrEqual(0.5);
    expect(v.distance).toBe(5);
  });

  it("comes closer on the roomiest side when every side is walled", () => {
    const v = clearView(centre, fromX, 5, (_f, dir) => (dir.y > 0.9 ? 3 : 1));
    expect(v.direction.y).toBeCloseTo(1);
    expect(v.distance).toBeCloseTo(2.7);
  });
});
