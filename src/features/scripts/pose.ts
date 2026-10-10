/** Placements and the math of smooth moves: easing, slerp, and turning about a pivot that stays put. */
import * as THREE from "three";
import type { Placement } from "@/net/scripts-bridge";
import type { Quat, Vec3 } from "@/lib/vec";
import { add, mul3, rotate, sub } from "@/lib/vec";

export type { Placement };

/** a turn about a pivot: the pivot's world point and its point in the object's unit space */
export interface Pivot {
  world: Vec3;
  local: Vec3;
}

const DEG = Math.PI / 180;

export const placementOf = (o: Placement): Placement => ({ pos: [...o.pos], quat: [...o.quat], size: [...o.size] });

/** ease in and out */
export const ease = (k: number): number => (k >= 1 ? 1 : k * k * (3 - 2 * k));

const toQ = (q: Quat) => new THREE.Quaternion(q[0], q[1], q[2], q[3]);
const fromQ = (q: THREE.Quaternion): Quat => [q.x, q.y, q.z, q.w];

export const normalizeQuat = (q: Quat): Quat => fromQ(toQ(q).normalize());

/** `q` followed by a turn of x, y, z degrees about the object's own axes */
export function turned(q: Quat, degrees: Vec3): Quat {
  const e = new THREE.Euler(degrees[0] * DEG, degrees[1] * DEG, degrees[2] * DEG);
  return fromQ(toQ(q).multiply(new THREE.Quaternion().setFromEuler(e)).normalize());
}

/** where an object is `k` (0…1) of the way from `from` to `to` */
export function poseAt(from: Placement, to: Placement, k: number, pivot?: Pivot): Placement {
  if (k >= 1) return placementOf(to);
  const e = ease(k);
  const quat = fromQ(toQ(from.quat).slerp(toQ(to.quat), e));
  const size: Vec3 = [0, 1, 2].map((i) => from.size[i] + (to.size[i] - from.size[i]) * e) as Vec3;
  // turning about a pivot: the pivot stays put while the object swings around it
  const pos = pivot
    ? sub(pivot.world, rotate(mul3(pivot.local, size), quat))
    : ([0, 1, 2].map((i) => from.pos[i] + (to.pos[i] - from.pos[i]) * e) as Vec3);
  return { pos, quat, size };
}

/** the position that keeps the pivot (unit-space point `local`) in place when the rotation goes from q to nq */
export function pivotTurn(p: Placement, nq: Quat, local: Vec3): { pos: Vec3; world: Vec3 } {
  const arm = mul3(local, p.size);
  const world = add(p.pos, rotate(arm, p.quat));
  return { pos: sub(world, rotate(arm, nq)), world };
}
