/**
 * An avatar as other people see it: where it is and what it is doing. The net layer sends it a few times a second
 * and eases the far side's body towards it (net calls it `AvatarSnapshot`).
 */
import type { Vec3 } from "@/lib/vec";
import type { AvatarState } from "./state";

export interface BodySnapshot {
  pos: Vec3;
  /** radians about Z */
  yaw: number;
  /** metres per second */
  speed: number;
  /** walking backwards */
  back: boolean;
  talking: boolean;
  flying: boolean;
  sitting: boolean;
  onGround: boolean;
  /** turning rate, for the turn-in-place animation */
  turn: number;
  /** -1 down … 1 up, while flying */
  climb: number;
}

/** whose speech bubble: yours, a peer's, or an object's (its script spoke) */
export type Speaker = { kind: "self" } | { kind: "peer"; id: string } | { kind: "object"; id: string };

export function snapshotOf(A: AvatarState): BodySnapshot {
  return {
    pos: [A.pos.x, A.pos.y, A.pos.z],
    yaw: A.yaw,
    speed: A.speed,
    back: A.back,
    talking: A.talking,
    flying: A.flying,
    sitting: A.sitting,
    onGround: A.onGround,
    turn: A.turn,
    climb: A.climb,
  };
}

/** how fast and which way the body moves over the ground, m/s (seated: not at all) */
export function velocityOf(s: BodySnapshot): Vec3 {
  if (s.sitting) return [0, 0, 0];
  const v = s.back ? -s.speed : s.speed;
  return [-Math.sin(s.yaw) * v, Math.cos(s.yaw) * v, 0];
}
