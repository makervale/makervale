/** Pieces every drag uses: remember the start, go back to it before each move, leave a copy, show the result. */
import * as THREE from "three";
import type { Vec3 } from "@/lib/vec";
import { cloneObj } from "@/world/model";
import type { Drag, DragStart } from "./drag-types";
import type { ManipEnv } from "./env";
import { applyToVerts, softWeights } from "./soft";
import type { SoftWeights } from "./soft";

/** how far the cursor must leave the axis before the drag snaps to the ruler, pixels */
export const SNAP_DISTANCE_PX = 22;

export function startState(env: ManipEnv, elem: boolean): DragStart {
  const objs = env.store.selected().map((o) => ({
    id: o.id,
    pos: [...o.pos] as Vec3,
    quat: [...o.quat] as typeof o.quat,
    size: [...o.size] as Vec3,
  }));
  const t = elem ? env.store.editTarget() : null;
  return { objs, verts: t ? t.mesh.v.map((v) => [...v] as Vec3) : null };
}

export function softFor(env: ManipEnv): SoftWeights | undefined {
  const t = env.store.editTarget();
  const M = t && env.renderer.views.worldMatrixOf(t);
  if (!t || !M) return undefined;
  const s = env.store.settings;
  return softWeights(t, M, env.store.selection.elements, s.softRadiusMetres, s.mirrorX);
}

/** every move starts again from the state before the drag */
export function restoreStart(env: ManipEnv, d: Drag): void {
  for (const s of d.start.objs) {
    const o = env.store.byId(s.id);
    if (!o) continue;
    o.pos = [...s.pos];
    o.quat = [...s.quat];
    o.size = [...s.size];
  }
  const t = env.store.editTarget();
  if (d.elem && t && d.start.verts) t.mesh.v = d.start.verts.map((v) => [...v] as Vec3);
}

/** move the dragged elements: `fn` maps a world point to where it goes */
export function applyElem(env: ManipEnv, d: Drag, fn: (p: THREE.Vector3) => THREE.Vector3): void {
  const t = env.store.editTarget();
  const M = t && env.renderer.views.worldMatrixOf(t);
  if (!t || !M || !d.start.verts || !d.soft) return;
  applyToVerts(t, M, d.start.verts, d.soft, fn);
}

/** Shift+drag: the originals move on, copies stay where they were */
export function leaveCopy(env: ManipEnv): void {
  const { store, commands } = env;
  const world = store.world;
  const groups: Record<string, string> = {};
  const copies = store.selected().map((o) => {
    const c = cloneObj(o);
    c.id = "o" + world.seq++;
    if (c.group) c.group = groups[c.group] ??= "g" + world.seq++;
    return c;
  });
  commands.apply(
    copies.map((c) => c.id),
    () => world.objects.push(...copies),
  );
  commands.notice("Copy left behind");
}

/** the view follows the drag; history waits for the drop */
export function showMoved(env: ManipEnv, d: Drag): void {
  const t = env.store.editTarget();
  if (d.elem && t) {
    env.renderer.views.syncShape(t);
    env.renderer.highlights.refreshOverlay(t);
    env.commands.dragging([t.id]);
    return;
  }
  env.commands.dragging(env.store.selected().map((o) => o.id));
}

/** where the ray under the cursor meets a plane */
export function hitPlane(env: ManipEnv, x: number, y: number, plane: THREE.Plane): THREE.Vector3 | null {
  return env.renderer.picker.rayAt(x, y).ray.intersectPlane(plane, new THREE.Vector3());
}

/** the plane through `p` that contains axis `A` and faces the camera as much as it can */
export function planeAlong(
  env: ManipEnv,
  A: THREE.Vector3,
  p: THREE.Vector3,
): { n: THREE.Vector3; plane: THREE.Plane } {
  const view = env.camera.position.clone().sub(p).normalize();
  const n = new THREE.Vector3().crossVectors(A, new THREE.Vector3().crossVectors(view, A)).normalize();
  if (n.lengthSq() < 1e-6) n.copy(view);
  return { n, plane: new THREE.Plane().setFromNormalAndCoplanarPoint(n, p) };
}

/** a direction across the axis, towards the cursor (the side the ruler is drawn on) */
export function across(off: THREE.Vector3, n: THREE.Vector3, A: THREE.Vector3): THREE.Vector3 {
  return off.lengthSq() > 1e-12 ? off.clone().normalize() : n.clone().cross(A).normalize();
}
