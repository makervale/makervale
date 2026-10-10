import { describe, expect, it } from "vitest";
import * as THREE from "three";
import { easeBody, easeFactor, wrapAngle } from "./body-easing";

describe("body easing", () => {
  it("wraps angles into -π … π", () => {
    expect(wrapAngle(3 * Math.PI)).toBeCloseTo(Math.PI);
    expect(wrapAngle(-Math.PI / 2 - 2 * Math.PI)).toBeCloseTo(-Math.PI / 2);
  });
  it("turns the short way round", () => {
    const root = new THREE.Object3D();
    root.rotation.z = 3;
    easeBody(root, new THREE.Vector3(), -3, 1);
    expect(wrapAngle(root.rotation.z)).toBeCloseTo(-3);
    expect(root.rotation.z).toBeGreaterThan(3);
  });
  it("approaches but never overshoots", () => {
    expect(easeFactor(0, 12)).toBe(0);
    expect(easeFactor(1, 12)).toBeLessThan(1);
    expect(easeFactor(1 / 60, 12)).toBeCloseTo(1 - Math.exp(-0.2));
  });
});
