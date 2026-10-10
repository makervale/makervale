/**
 * A camera direction from which the target can be seen: if walls stand between the target and the camera, look
 * around it (turning about the vertical) for a clear side; if none is clear, use the side with the most room and
 * come closer.
 */
import * as THREE from "three";

/** distance from `from` along `dir` to the first solid, or null when nothing is in the way */
export type RayCast = (from: THREE.Vector3, dir: THREE.Vector3, far: number) => number | null;

export interface View {
  direction: THREE.Vector3;
  distance: number;
}

/** tried in this order: as asked, then further and further round each way */
const TURNS_DEGREES = [0, 45, -45, 90, -90, 135, -135, 180];
const WALL_GAP_M = 0.3;
const NEAREST_M = 0.5;
const UP = new THREE.Vector3(0, 0, 1);

export function clearView(centre: THREE.Vector3, direction: THREE.Vector3, distance: number, cast: RayCast): View {
  let best: View | null = null;
  let bestRoom = -1;
  for (const degrees of TURNS_DEGREES) {
    const dir = direction.clone().normalize().applyAxisAngle(UP, THREE.MathUtils.degToRad(degrees));
    const hit = cast(centre, dir, distance);
    if (hit === null) return { direction: dir, distance };
    if (hit > bestRoom) {
      bestRoom = hit;
      best = { direction: dir, distance: Math.max(NEAREST_M, hit - WALL_GAP_M) };
    }
  }
  return best!;
}
