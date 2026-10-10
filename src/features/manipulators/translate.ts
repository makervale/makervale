/** Moving along an arrow (with the ruler and its snapping) or across a plane square. */
import * as THREE from "three";
import type { Vec3 } from "@/lib/vec";
import { fmt } from "@/ui/dom";
import { across, applyElem, hitPlane, leaveCopy, restoreStart, SNAP_DISTANCE_PX } from "./drag-common";
import type { TranslateDrag } from "./drag-types";
import type { ManipEnv } from "./env";
import { worldPerPixel } from "./env";
import { snapTo } from "./ruler-math";

const AXIS_NAMES = "XYZ";

/** returns false when the cursor is off the drag plane (nothing moved) */
export function translateMove(env: ManipEnv, d: TranslateDrag, x: number, y: number): boolean {
  if (d.shift && !d.copied && !d.elem) {
    d.copied = true;
    leaveCopy(env);
  }
  restoreStart(env, d);
  const hit = hitPlane(env, x, y, d.plane);
  if (!hit) return false;
  const delta = d.kind === "axis" ? alongAxis(env, d, hit, x, y) : acrossPlane(env, d, hit, x, y);
  if (d.elem) applyElem(env, d, (p) => p.add(delta));
  else for (const o of env.store.selected()) o.pos = new THREE.Vector3().fromArray(o.pos).add(delta).toArray() as Vec3;
  d.pivotNow = d.pivot0.clone().add(delta);
  return true;
}

/** the move along the arrow; far enough off the axis, it snaps to the ruler's steps */
function alongAxis(env: ManipEnv, d: TranslateDrag, hit: THREE.Vector3, x: number, y: number): THREE.Vector3 {
  const along = hit.clone().sub(d.pivot0).dot(d.A);
  const along0 = d.hit0.clone().sub(d.pivot0).dot(d.A);
  const off = hit.clone().sub(d.pivot0).addScaledVector(d.A, -along);
  const offPx = off.length() / worldPerPixel(env, d.pivot0);
  const unit = env.rulers.unit(d.pivot0, d.A);
  const inSnap = env.store.settings.snap && offPx > SNAP_DISTANCE_PX;
  const base = d.pivot0.dot(d.A);
  const move = inSnap ? snapTo(base + along - along0, unit) - base : along - along0;
  const delta = d.A.clone().multiplyScalar(move);
  env.rulers.ruler({ p0: d.pivot0, A: d.A, perp: across(off, d.n, d.A), unit, active: inSnap, along: move });
  // world axes on an object show where it is; other axes show how far it moved
  const relative = env.store.settings.axes !== "world" || !!env.store.editTarget();
  const shown = relative ? move : d.pivot0.clone().add(delta).getComponent(d.axis);
  const step = inSnap ? " · step " + fmt(unit, unit < 0.01 ? 4 : 3) : "";
  env.badge.show(x, y, `${AXIS_NAMES[d.axis]} ${fmt(shown)} m${step}`, inSnap);
  return delta;
}

function acrossPlane(env: ManipEnv, d: TranslateDrag, hit: THREE.Vector3, x: number, y: number): THREE.Vector3 {
  const delta = hit.clone().sub(d.hit0);
  env.rulers.clear();
  const p = d.pivot0.clone().add(delta);
  env.badge.show(x, y, `${fmt(p.x, 2)} · ${fmt(p.y, 2)} · ${fmt(p.z, 2)}`, false);
  return delta;
}
