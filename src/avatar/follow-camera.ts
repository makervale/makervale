/** The camera rides behind and a little above your avatar, never through walls. */
import * as THREE from "three";
import type { CameraController } from "@/render/camera/controller";
import { forwardOf } from "./state";

/** the camera looks this far ahead of the head, metres */
const LOOK_AHEAD_M = 1.2;
/** height above the head per metre of follow distance */
const RISE_PER_M = 0.32;
const WALL_GAP_M = 0.35;
const NEAREST_M = 0.8;
const HEAD_STANDING = 0.92;
const HEAD_SEATED = 0.68;

/** distance along a ray to the first solid, or null */
export type RayCast = (from: THREE.Vector3, dir: THREE.Vector3, far: number) => number | null;

export function headOf(feet: THREE.Vector3, height: number, sitting: boolean): THREE.Vector3 {
  return feet.clone().add(new THREE.Vector3(0, 0, height * (sitting ? HEAD_SEATED : HEAD_STANDING)));
}

export function followBehind(cam: CameraController, head: THREE.Vector3, yaw: number, cast: RayCast): void {
  const f = forwardOf(yaw);
  const dist = cam.followDist;
  cam.focus.copy(head).addScaledVector(f, LOOK_AHEAD_M);
  cam.offset
    .copy(f)
    .multiplyScalar(-dist)
    .add(new THREE.Vector3(0, 0, dist * RISE_PER_M))
    .addScaledVector(f, -LOOK_AHEAD_M);
  cam.focusObj = null;
  // stay on this side of walls
  const far = cam.offset.length() + LOOK_AHEAD_M;
  const dir = cam.focus.clone().add(cam.offset).sub(head).normalize();
  const hit = cast(head, dir, far);
  if (hit === null) return;
  const camPos = head.clone().addScaledVector(dir, Math.max(NEAREST_M, hit - WALL_GAP_M));
  cam.offset.copy(camPos.sub(cam.focus));
}
