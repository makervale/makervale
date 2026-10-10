import { describe, expect, it } from "vitest";
import * as THREE from "three";
import { Animator } from "./animator";
import type { Rig } from "./animator";
import type { Bone } from "./bones";
import type { Clip } from "./clips";
import { clip, clipNames, sampleBone } from "./clips";
import { GESTURES } from "./gestures";

// a gesture or any clip must never show the rest T-pose (arms straight out): that is what "starts with a T-pose" was
/** the largest rotation of the bones that show a T-pose most clearly */
function worstBend(c: Clip, t: number, q: THREE.Quaternion): number {
  let worst = 0;
  for (const b of ["leftUpperArm", "rightUpperArm", "spine", "leftUpperLeg"] as const) {
    if (sampleBone(c, b, t, q)) worst = Math.max(worst, 2 * Math.acos(Math.min(1, Math.abs(q.w))));
  }
  return worst;
}

describe("animation clips", () => {
  it("no clip passes through the T-pose at its start or end", () => {
    const q = new THREE.Quaternion();
    for (const name of clipNames()) {
      const c = clip(name)!;
      for (const t of [0, c.dur * 0.999]) {
        expect(worstBend(c, t, q), `${name} at ${t.toFixed(2)} s`).toBeGreaterThan(0.05);
      }
    }
  });

  it("every gesture has a clip", () => {
    for (const g of Object.values(GESTURES)) {
      expect(clip(g.stand)).toBeTruthy();
      if (g.sit) expect(clip(g.sit)).toBeTruthy();
    }
  });
});

describe("Animator", () => {
  const still = { speed: 0, onGround: true, flying: false, sitting: false };

  it("settles on idle when standing still", () => {
    const a = new Animator();
    for (let i = 0; i < 60; i++) a.update(still, 1 / 30);
    expect(a.weights.get("idle")).toBeGreaterThan(0.9);
    expect(a.hipsPos.y).toBeGreaterThan(0.8);
  });

  it("blends walk into jog between their natural speeds", () => {
    const a = new Animator(1);
    for (let i = 0; i < 90; i++) a.update({ ...still, speed: 2.4 }, 1 / 30);
    expect(a.weights.get("walk")).toBeGreaterThan(0.2);
    expect(a.weights.get("jog")).toBeGreaterThan(0.2);
  });

  it("folds missing bones into their children", () => {
    const set = new Map<Bone, THREE.Quaternion>();
    const rig: Rig = { has: (b) => b !== "chest" && b !== "upperChest", set: (b, q) => set.set(b, q), hips: () => {} };
    const a = new Animator();
    a.update(still, 1 / 30);
    a.apply(rig);
    expect(set.has("chest")).toBe(false);
    const expected = a.out.get("chest")!.clone().multiply(a.out.get("upperChest")!).multiply(a.out.get("neck")!);
    expect(set.get("neck")!.angleTo(expected)).toBeLessThan(1e-6);
  });
});
