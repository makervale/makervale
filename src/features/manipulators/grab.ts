/**
 * Dragging without a handle: an object slides across the horizontal plane through the point grabbed, an element
 * across the plane facing the camera.
 */
import * as THREE from "three";
import type { Vec3 } from "@/lib/vec";
import { fmt } from "@/ui/dom";
import { applyElem, hitPlane, leaveCopy, restoreStart, softFor, startState } from "./drag-common";
import type { GrabDrag } from "./drag-types";
import type { ManipEnv } from "./env";
import { pivotOf } from "./reference";

export interface GrabStart {
  /** the point grabbed, world space */
  hitPoint: THREE.Vector3;
  x: number;
  y: number;
  /** leave a copy behind */
  shift: boolean;
  /** drag the selected elements, not the objects */
  elem: boolean;
}

export function startGrab(env: ManipEnv, g: GrabStart): GrabDrag {
  const ids = env.store.selected().map((o) => o.id);
  const { hitPoint, x, y, shift, elem } = g;
  return { kind: "grab", sx: x, sy: y, shift, elem, hitPoint, started: false, ids, start: { objs: [], verts: null } };
}

/** the first move opens the history entry (unless an action that led here, like a pull, already did) */
function begin(env: ManipEnv, d: GrabDrag): THREE.Plane {
  d.started = true;
  env.commands.startHeld("Move", d.ids);
  const t = d.elem ? env.store.editTarget() : null;
  d.start = startState(env, !!t);
  if (t) d.soft = softFor(env);
  if (d.shift && !d.elem) leaveCopy(env);
  if (d.elem) {
    const facing = env.camera.getWorldDirection(new THREE.Vector3());
    return new THREE.Plane().setFromNormalAndCoplanarPoint(facing, d.hitPoint);
  }
  return new THREE.Plane(new THREE.Vector3(0, 0, 1), -d.hitPoint.z);
}

export function grabMove(env: ManipEnv, d: GrabDrag, x: number, y: number): boolean {
  if (!d.started) d.plane = begin(env, d);
  const hit = d.plane && hitPlane(env, x, y, d.plane);
  if (!hit) return false;
  const delta = hit.sub(d.hitPoint);
  restoreStart(env, d);
  if (d.elem && env.store.editTarget()) {
    applyElem(env, d, (p) => p.add(delta));
    env.badge.show(x, y, `${fmt(delta.length())} m`, false);
    return true;
  }
  const objs = env.store.selected();
  for (const o of objs) o.pos = new THREE.Vector3().fromArray(o.pos).add(delta).toArray() as Vec3;
  const p = pivotOf(env, objs);
  env.badge.show(x, y, `${fmt(p.x, 2)} · ${fmt(p.y, 2)} m`, false);
  return true;
}
