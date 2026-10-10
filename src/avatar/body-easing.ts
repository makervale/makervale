/** Bodies glide to where their avatar is instead of jumping, for your own avatar and for other people's. */
import type * as THREE from "three";

/** the same angle in -π … π */
export const wrapAngle = (a: number): number => Math.atan2(Math.sin(a), Math.cos(a));

/** the fraction of the way to go this frame, for an exponential approach at `rate` per second */
export const easeFactor = (dt: number, rate: number): number => 1 - Math.exp(-dt * rate);

/** turn a body about Z by the fraction `k` of the shortest way to `yaw` */
export function turnTowards(root: THREE.Object3D, yaw: number, k: number): void {
  root.rotation.z += wrapAngle(yaw - root.rotation.z) * k;
}

/** move and turn a body by the fraction `k` of the way to its target */
export function easeBody(root: THREE.Object3D, pos: THREE.Vector3, yaw: number, k: number): void {
  root.position.lerp(pos, k);
  turnTowards(root, yaw, k);
}
