/** One frame of walking or flying: turn, move (sliding along walls), climb steps, jump, fall, take off, land. */
import * as THREE from "three";
import type { Collider } from "./collision";
import { STEP_HEIGHT_M } from "./collision";
import type { AvatarState } from "./state";
import { forwardOf, rightOf } from "./state";

export interface MoveInput {
  /** 1 forward, -1 back */
  fwd: number;
  /** 1 right, -1 left */
  lr: number;
  up: boolean;
  down: boolean;
  /** Shift: sidestep with A/D, run with W, fly fast */
  shift: boolean;
}

export interface MoveWorld {
  collider: Collider;
  solids: THREE.Object3D[];
  /** flying started or stopped */
  changed(): void;
  /** how hard what you stand on throws you up, m/s (a trampoline); 0 for ordinary ground */
  springOf?(ground: THREE.Object3D | null): number;
  /** a spring just threw you up */
  bounced?(): void;
}

const TURN_RATE = 2.4; // rad/s
const WALK_SPEED = 2.2; // m/s
const RUN_SPEED = 5.2;
const FLY_SPEED = 8;
const FLY_FAST_SPEED = 16;
const BACKWARDS_FACTOR = 0.55;
const CLIMB_SPEED = 5; // m/s while flying
const JUMP_SPEED = 4.6; // m/s
const GRAVITY = 9.8; // m/s²
/** holding jump this long in the air takes off */
const TAKE_OFF_HOLD_S = 0.45;
/** lower than this above the ground, flying down lands */
const LANDING_GAP_M = 0.05;
/** drops smaller than this are stepped down, not fallen */
const STEP_DOWN_M = 0.3;

function moveSpeed(A: AvatarState, input: MoveInput): number {
  if (A.flying) return input.shift ? FLY_FAST_SPEED : FLY_SPEED;
  return input.shift && input.fwd > 0 ? RUN_SPEED : WALK_SPEED;
}

/** this frame's step on the ground plane; turns the avatar unless A/D sidestep */
function stepVector(A: AvatarState, input: MoveInput, dt: number): THREE.Vector3 {
  let strafe = 0;
  if (input.shift && !A.flying) strafe = input.lr;
  else {
    A.turn = input.lr * TURN_RATE;
    A.yaw -= A.turn * dt;
  }
  const move = forwardOf(A.yaw).multiplyScalar(input.fwd).add(rightOf(A.yaw).multiplyScalar(strafe));
  if (move.lengthSq() > 1) move.normalize();
  const back = input.fwd < 0 && !A.flying;
  move.multiplyScalar(moveSpeed(A, input) * dt * (back ? BACKWARDS_FACTOR : 1));
  A.speed = move.length() / Math.max(dt, 1e-6);
  A.back = back;
  return move;
}

/** move horizontally; blocked straight ahead, try each axis alone so you slide along walls */
export function walk(A: AvatarState, input: MoveInput, dt: number, w: MoveWorld): void {
  const move = stepVector(A, input, dt);
  for (const d of [move, new THREE.Vector3(move.x, 0, 0), new THREE.Vector3(0, move.y, 0)]) {
    if (d.lengthSq() < 1e-12) continue;
    if (w.collider.blocked(A.pos, d, w.solids, A.flying)) continue;
    const g = w.collider.groundAt(A.pos.x + d.x, A.pos.y + d.y, A.pos.z + STEP_HEIGHT_M + 0.05, w.solids).z;
    if (!A.flying && g > A.pos.z + STEP_HEIGHT_M) continue;
    A.pos.add(d);
    break;
  }
}

function fly(A: AvatarState, input: MoveInput, dt: number, g: number, w: MoveWorld): void {
  A.climb = (input.up ? 1 : 0) - (input.down ? 1 : 0);
  A.pos.z += A.climb * CLIMB_SPEED * dt;
  if (A.pos.z < g) A.pos.z = g;
  if (input.down && A.pos.z - g < LANDING_GAP_M) {
    A.flying = false;
    w.changed();
  }
}

function jumpAndFall(A: AvatarState, input: MoveInput, dt: number, g: number, w: MoveWorld): void {
  if (input.up && A.onGround) {
    A.vz = JUMP_SPEED;
    A.onGround = false;
    A.airHold = 0;
  }
  if (!A.onGround && input.up) {
    A.airHold += dt;
    if (A.airHold > TAKE_OFF_HOLD_S) {
      A.flying = true;
      A.vz = 0;
      w.changed();
    }
  }
  const above = A.pos.z - g;
  if (A.onGround && above < STEP_DOWN_M && above > 0) A.pos.z = g; // walk down steps without hopping
  if (A.pos.z > g + 1e-3 || A.vz > 0) {
    A.vz -= GRAVITY * dt;
    A.pos.z += A.vz * dt;
    A.onGround = false;
    if (A.pos.z > g) return;
    A.pos.z = g;
    A.vz = 0;
    A.onGround = true;
    return;
  }
  A.pos.z = Math.max(A.pos.z, g);
  A.onGround = true;
  A.vz = 0;
}

/** up and down: flying climbs and lands, walking jumps, falls and holds jump to take off */
export function rise(A: AvatarState, input: MoveInput, dt: number, w: MoveWorld): void {
  const ground = w.collider.groundAt(A.pos.x, A.pos.y, A.pos.z + STEP_HEIGHT_M + 0.05, w.solids);
  if (A.flying) fly(A, input, dt, ground.z, w);
  else jumpAndFall(A, input, dt, ground.z, w);
  if (A.onGround && !A.flying) springBack(A, w.springOf?.(ground.object) ?? 0, w);
}

/** standing on (or landing on) something springy throws you up again */
function springBack(A: AvatarState, spring: number, w: MoveWorld): void {
  if (spring <= 0) return;
  A.vz = spring;
  A.onGround = false;
  A.airHold = 0;
  w.bounced?.();
}
