/** Turning on a ring: the angle the cursor sweeps around the pivot; outside the ring it snaps to the ticks. */
import * as THREE from "three";
import type { Quat, Vec3 } from "@/lib/vec";
import { fmt } from "@/ui/dom";
import { applyElem, restoreStart } from "./drag-common";
import type { RotateDrag } from "./drag-types";
import type { ManipEnv } from "./env";
import { worldPerPixel } from "./env";
import { snapTo } from "./ruler-math";

const DEG = Math.PI / 180;
const STEP = 5.625 * DEG;
/** the cursor this far outside the ring (times its radius) snaps */
const SNAP_OUTSIDE = 1.18;

/** the same angle in -π … π */
const wrapAngle = (a: number): number => Math.atan2(Math.sin(a), Math.cos(a));

export function rotateMove(env: ManipEnv, d: RotateDrag, x: number, y: number): boolean {
  restoreStart(env, d);
  const a = Math.atan2(-(y - d.c.y), x - d.c.x);
  d.acc += wrapAngle(a - d.prevAngle);
  d.prevAngle = a;
  // seen from behind the axis, the sweep turns the other way
  const sign = d.A.dot(env.camera.position.clone().sub(d.pivot0)) >= 0 ? 1 : -1;
  const inSnap = env.store.settings.snap && Math.hypot(x - d.c.x, y - d.c.y) > d.ringPx * SNAP_OUTSIDE;
  const angle = inSnap ? snapTo(d.acc * sign, STEP) : d.acc * sign;
  const R = new THREE.Quaternion().setFromAxisAngle(d.A, angle);
  const turn = (p: THREE.Vector3) => p.sub(d.pivot0).applyQuaternion(R).add(d.pivot0);
  if (d.elem) applyElem(env, d, turn);
  else {
    for (const o of env.store.selected()) {
      o.pos = turn(new THREE.Vector3().fromArray(o.pos)).toArray() as Vec3;
      o.quat = R.clone().multiply(new THREE.Quaternion().fromArray(o.quat)).normalize().toArray() as Quat;
    }
  }
  env.rulers.ringTicks(d.pivot0, d.A, worldPerPixel(env, d.pivot0) * d.ringPx, inSnap);
  env.badge.show(x, y, `${fmt(angle / DEG, 2)}°${inSnap ? " · step 5.625°" : ""}`, inSnap);
  d.pivotNow = d.pivot0;
  return true;
}
