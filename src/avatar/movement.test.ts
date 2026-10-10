import { describe, expect, it } from "vitest";
import * as THREE from "three";
import type { Collider } from "./collision";
import type { MoveWorld } from "./movement";
import { rise } from "./movement";
import { newAvatarState } from "./state";

const still = { fwd: 0, lr: 0, up: false, down: false, shift: false };
const mat = new THREE.Object3D();

function world(spring: number, bounces: string[]): MoveWorld {
  const collider = { groundAt: () => ({ z: 0, object: mat }) } as unknown as Collider;
  return {
    collider,
    solids: [],
    changed: () => {},
    springOf: (g) => (g === mat ? spring : 0),
    bounced: () => bounces.push("boing"),
  };
}

describe("rise", () => {
  it("a trampoline throws you up when you stand on it", () => {
    const A = newAvatarState();
    A.pos.set(0, 0, 0);
    const bounces: string[] = [];
    rise(A, still, 1 / 60, world(10, bounces));
    expect(A.vz).toBe(10);
    expect(A.onGround).toBe(false);
    expect(bounces).toEqual(["boing"]);
    let top = 0;
    for (let i = 0; i < 120; i++) {
      rise(A, still, 1 / 60, world(10, bounces));
      top = Math.max(top, A.pos.z);
    }
    expect(top).toBeGreaterThan(4);
  });

  it("ordinary ground keeps you standing", () => {
    const A = newAvatarState();
    A.pos.set(0, 0, 0);
    rise(A, still, 1 / 60, world(0, []));
    expect(A.onGround).toBe(true);
    expect(A.vz).toBe(0);
  });
});
