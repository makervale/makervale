/** Sitting down on what you right-clicked, and getting up again without ending up standing on the seat. */
import * as THREE from "three";
import type { Collider } from "./collision";
import { forwardOf } from "./state";

/** look this far above the clicked point for the seat's top, metres */
const SEAT_PROBE_M = 1.0;
/** the steps tried forward when standing up, longest first */
const STAND_STEPS_M = [0.6, 0.4, 0.25];
/** standing up checks for walls at the knees and the waist */
const STAND_PROBES_M = [0.3, 0.9];
const STAND_PROBE_ABOVE_M = 0.3;
/** a step may not land higher than this above the seat */
const STAND_RISE_M = 0.1;

export interface Seat {
  pos: THREE.Vector3;
  yaw: number;
}

/** where to sit for a click on `point`: on top of it, back to a backrest if there is one, else facing the camera */
export function seatAt(
  point: THREE.Vector3,
  cameraPos: THREE.Vector3,
  collider: Collider,
  solids: THREE.Object3D[],
): Seat {
  const top = collider.groundAt(point.x, point.y, point.z + SEAT_PROBE_M, solids).z;
  const pos = new THREE.Vector3(point.x, point.y, Math.max(point.z, top));
  let yaw = collider.backrestYaw(pos, solids);
  if (yaw === null) {
    const d = cameraPos.clone().sub(point);
    yaw = Math.atan2(-d.x, d.y);
  }
  return { pos, yaw };
}

/** where to stand after sitting: a short step forward onto lower ground, or null to stay put */
export function standingSpot(
  pos: THREE.Vector3,
  yaw: number,
  collider: Collider,
  solids: THREE.Object3D[],
): THREE.Vector3 | null {
  const f = forwardOf(yaw);
  for (const d of STAND_STEPS_M) {
    const step = f.clone().multiplyScalar(d);
    if (collider.blocked(pos, step, solids, false, STAND_PROBES_M)) continue;
    const g = collider.groundAt(pos.x + step.x, pos.y + step.y, pos.z + STAND_PROBE_ABOVE_M, solids).z;
    if (g > -Infinity && g < pos.z + STAND_RISE_M) return new THREE.Vector3(pos.x + step.x, pos.y + step.y, g);
  }
  return null;
}
