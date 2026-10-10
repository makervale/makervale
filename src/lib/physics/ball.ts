/**
 * One step of a ball: gravity, moving, then pushing out of whatever it overlaps and bouncing off it.
 * The world is only seen through `contacts` (the ground, walls, objects), so this is plain maths and easy to test.
 */
import type { Vec3 } from "@/lib/vec";
import { add, dot, length, scale, sub } from "@/lib/vec";

export const GRAVITY_M_S2 = 9.81;

export interface BallState {
  pos: Vec3;
  vel: Vec3;
}

export interface BallShape {
  radius: number;
  /** 0 dead … 1 perfectly bouncy */
  bounce: number;
}

/** something the ball overlaps: which way is out, and how deep in it is */
export interface Contact {
  normal: Vec3;
  depth: number;
  /** the object hit; null for the ground */
  id: string | null;
}

export interface Hit {
  id: string | null;
  /** how fast the ball struck, m/s along the normal */
  speed: number;
}

/** below this the ball stops bouncing and just rests or rolls */
const REST_SPEED_M_S = 0.6;
/**
 * Rolling on grass or paving: a steady loss of speed (rolling resistance) plus a little that grows with speed.
 * A steady loss makes a ball come to a clear stop instead of creeping on for ages, as a real one does.
 */
const ROLL_DECEL_M_S2 = 0.8;
const ROLL_DRAG_PER_S = 0.2;
/** a little air resistance, so a hard kick doesn't go on for ever */
const AIR_DRAG = 0.05;
const FLOOR_NORMAL_Z = 0.6;

export type ContactProbe = (pos: Vec3, radius: number) => Contact[];

export function stepBall(s: BallState, shape: BallShape, dt: number, contacts: ContactProbe): Hit[] {
  s.vel = [s.vel[0], s.vel[1], s.vel[2] - GRAVITY_M_S2 * dt];
  s.vel = scale(s.vel, 1 - AIR_DRAG * dt);
  s.pos = add(s.pos, scale(s.vel, dt));
  const hits: Hit[] = [];
  let onFloor = false;
  for (const c of contacts(s.pos, shape.radius)) {
    s.pos = add(s.pos, scale(c.normal, c.depth));
    if (c.normal[2] > FLOOR_NORMAL_Z) onFloor = true;
    const hit = collide(s, shape, c);
    if (hit) hits.push(hit);
  }
  // once per step, however many floor pieces it touches (seams between objects)
  if (onFloor) s.vel = rollOn(s.vel, dt);
  return hits;
}

function collide(s: BallState, shape: BallShape, c: Contact): Hit | null {
  const into = dot(s.vel, c.normal);
  if (into >= 0) return null;
  // on a floor only a fall bounces: rolling over a small step (a painted line, a seam) must not make the ball hop
  const impact = c.normal[2] > FLOOR_NORMAL_Z ? -s.vel[2] : -into;
  const bounce = impact > REST_SPEED_M_S ? shape.bounce : 0;
  s.vel = sub(s.vel, scale(c.normal, (1 + bounce) * into));
  return { id: c.id, speed: -into };
}

/** friction along a floor slows the sideways motion, not the bounce */
function rollOn(vel: Vec3, dt: number): Vec3 {
  const h = Math.hypot(vel[0], vel[1]);
  if (h < 1e-6) return vel;
  const slower = Math.max(0, h - (ROLL_DECEL_M_S2 + ROLL_DRAG_PER_S * h) * dt);
  const k = slower / h;
  return [vel[0] * k, vel[1] * k, vel[2]];
}

export const speedOf = (s: BallState): number => length(s.vel);
