/**
 * People move the ball by walking into it. Walking dribbles: the ball is nudged a little ahead and stays near your
 * feet. Running kicks: it flies off faster than you and hops a little. Either way it goes mostly where you were
 * going, a bit off to the side if you caught it off-centre. A ball rolling into someone standing bounces off.
 */
import type { Vec3 } from "@/lib/vec";
import { add, dot, scale } from "@/lib/vec";
import type { BallShape, BallState } from "./ball";

export interface Mover {
  /** feet */
  pos: Vec3;
  vel: Vec3;
}

const BODY_RADIUS_M = 0.32;
const BODY_HEIGHT_M = 1.7;
/** slower than this, feet are standing still */
const STANDING_M_S = 0.2;
/** faster than this it's a run, and a touch becomes a kick */
const RUNNING_M_S = 3.5;
/** a walking touch knocks the ball on ahead of you, a few metres; you chase it and touch it again */
const DRIBBLE_GAIN = 2;
const KICK_GAIN = 1.35;
/** a kick's hop: vertical speed per m/s of foot speed */
const CHIP_PER_M_S = 0.45;
/** how much a kick follows the foot rather than the point of contact (0 … 1) */
const FOLLOW_FOOT = 0.8;
/**
 * While dribbling the ball drifts back towards the line you walk along: sideways speed per metre off the line.
 * Without it each off-centre touch pushes the ball further aside until you walk past it, which feels wrong.
 */
const DRIBBLE_CENTRING_PER_S = 1.2;
/** legs are soft: a ball rolling into someone keeps this much of its speed */
const LEGS_BOUNCE = 0.35;

/** true when someone touched the ball (its velocity and position may have changed) */
export function pushByPeople(s: BallState, shape: BallShape, people: Mover[]): boolean {
  let pushed = false;
  for (const p of people) if (pushBy(s, shape, p)) pushed = true;
  return pushed;
}

function pushBy(s: BallState, shape: BallShape, p: Mover): boolean {
  const reach = shape.radius + BODY_RADIUS_M;
  if (s.pos[2] + shape.radius < p.pos[2] || s.pos[2] - shape.radius > p.pos[2] + BODY_HEIGHT_M) return false;
  const dx = s.pos[0] - p.pos[0];
  const dy = s.pos[1] - p.pos[1];
  const d = Math.hypot(dx, dy);
  if (d >= reach) return false;
  const n: Vec3 = d > 1e-6 ? [dx / d, dy / d, 0] : [1, 0, 0];
  // out of the body first, so the ball never sits inside someone
  s.pos = add(s.pos, scale(n, reach - d));
  const foot = Math.hypot(p.vel[0], p.vel[1]);
  if (foot < STANDING_M_S) bounceOffLegs(s, n);
  else kick(s, n, p, foot);
  return true;
}

function bounceOffLegs(s: BallState, n: Vec3): void {
  const into = dot(s.vel, n);
  if (into < 0) s.vel = add(s.vel, scale(n, -(1 + LEGS_BOUNCE) * into));
}

function kick(s: BallState, n: Vec3, p: Mover, foot: number): void {
  const along: Vec3 = [p.vel[0] / foot, p.vel[1] / foot, 0];
  if (foot > RUNNING_M_S) shoot(s, n, along, foot);
  else dribble(s, p, along, foot);
}

/** a proper kick: mostly where the foot goes, deflected by where it struck, with a hop */
function shoot(s: BallState, n: Vec3, along: Vec3, foot: number): void {
  const dir = horizontalUnit(add(scale(n, 1 - FOLLOW_FOOT), scale(along, FOLLOW_FOOT)));
  const target = foot * KICK_GAIN;
  const ahead = dot(s.vel, dir);
  // already flying away faster than that: the foot doesn't catch it
  if (ahead >= target) return;
  s.vel = add(s.vel, scale(dir, target - ahead));
  s.vel = [s.vel[0], s.vel[1], Math.max(s.vel[2], foot * CHIP_PER_M_S)];
}

/** walking: the ball rolls just ahead of you and drifts back to the line you walk along */
function dribble(s: BallState, p: Mover, along: Vec3, foot: number): void {
  if (dot(s.vel, along) >= foot * DRIBBLE_GAIN) return;
  const side = sideOf(along);
  const v = add(scale(along, foot * DRIBBLE_GAIN), scale(side, -offLine(s, p, along) * DRIBBLE_CENTRING_PER_S));
  s.vel = [v[0], v[1], s.vel[2]];
}

/** the direction to your left */
const sideOf = (along: Vec3): Vec3 => [-along[1], along[0], 0];

/** how far the ball is to the left (+) or right (-) of the line you walk along, metres */
function offLine(s: BallState, p: Mover, along: Vec3): number {
  return dot([s.pos[0] - p.pos[0], s.pos[1] - p.pos[1], 0], sideOf(along));
}

function horizontalUnit(v: Vec3): Vec3 {
  const l = Math.hypot(v[0], v[1]) || 1;
  return [v[0] / l, v[1] / l, 0];
}
