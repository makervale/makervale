/** Your avatar as data: where it is, how it moves, what it looks like. The controller is its only writer. */
import * as THREE from "three";
import type { Look } from "./look";
import { DEFAULT_LOOK } from "./look";

export interface AvatarState {
  /** feet position, world metres (Z up) */
  pos: THREE.Vector3;
  /** heading, radians; 0 faces +Y */
  yaw: number;
  /** vertical speed, m/s */
  vz: number;
  onGround: boolean;
  flying: boolean;
  sitting: boolean;
  /** horizontal speed this frame, m/s (drives the gait) */
  speed: number;
  back: boolean;
  /** turning rate, rad/s */
  turn: number;
  /** -1 down, 0, 1 up while flying */
  climb: number;
  /** seconds the jump key has been held in the air (long enough: take off) */
  airHold: number;
  talking: boolean;
  /** performance.now() until which the avatar talks */
  talkUntil: number;
  name: string;
  look: Look;
}

/** where you arrive: at the gate of the start scene */
export const SPAWN: readonly [number, number, number] = [0, -12.6, 0];

export function newAvatarState(): AvatarState {
  return {
    pos: new THREE.Vector3(...SPAWN),
    yaw: 0,
    vz: 0,
    onGround: true,
    flying: false,
    sitting: false,
    speed: 0,
    back: false,
    turn: 0,
    climb: 0,
    airHold: 0,
    talking: false,
    talkUntil: 0,
    name: "Builder Resident",
    look: { ...DEFAULT_LOOK },
  };
}

/** the direction the avatar faces, on the ground plane */
export const forwardOf = (yaw: number) => new THREE.Vector3(-Math.sin(yaw), Math.cos(yaw), 0);
export const rightOf = (yaw: number) => new THREE.Vector3(Math.cos(yaw), Math.sin(yaw), 0);
