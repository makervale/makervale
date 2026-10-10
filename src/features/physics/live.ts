/** What the physics remembers about each body between frames (velocity is not part of the saved scene). */
import type { Vec3 } from "@/lib/vec";
import type { Obj } from "@/world/model";

export interface Live {
  vel: Vec3;
  /** where the physics last put it; anything else moving it (a script, a drag) resets its velocity */
  lastPos: Vec3;
  /** where it was first seen: it comes back here if it falls off the world */
  start: Vec3;
  restS: number;
  asleep: boolean;
  /** after a kick here, the authority's older word on this body is ignored for a moment (see simulator.ts) */
  ignoreRemoteUntil: number;
  /** how far this screen's ball is from the authority's; worked off gradually, so the ball never jumps */
  error: Vec3;
}

export function newLive(o: Obj): Live {
  const at: Vec3 = [...o.pos];
  return {
    vel: [0, 0, 0],
    lastPos: at,
    start: [...at],
    restS: 0,
    // awake at first, so a body placed a little above the ground settles onto it instead of hanging there
    asleep: false,
    ignoreRemoteUntil: 0,
    error: [0, 0, 0],
  };
}

export const radiusOf = (o: Obj): number => Math.max(...o.size) / 2;

export function movedElsewhere(o: Obj, l: Live): boolean {
  const [x, y, z] = l.lastPos;
  return Math.abs(o.pos[0] - x) + Math.abs(o.pos[1] - y) + Math.abs(o.pos[2] - z) > 1e-4;
}
