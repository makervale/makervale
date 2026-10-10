/** Where the handles sit and which way they point: the pivot of the selection and the axes (world, local, normal). */
import * as THREE from "three";
import type { Manipulator, Store } from "@/app/store";
import { faceNormal } from "@/lib/mesh/mesh";
import { selectedFaces, selectedVerts, selectionCount } from "@/lib/mesh/selection";
import { topologyOf } from "@/lib/mesh/topology";
import type { Obj } from "@/world/model";
import { boxOf } from "@/render/camera/framing";
import type { ManipEnv } from "./env";

/** a single point can only be moved: turning or stretching it around itself changes nothing */
export function singlePoint(store: Store): boolean {
  const t = store.editTarget();
  const sel = store.selection.elements;
  return !!t && selectionCount(sel) > 0 && selectedVerts(t.mesh, sel).size < 2;
}

/** the handles to show: Ctrl turns move into rotate, Ctrl+Shift into stretch */
export function effectiveManipulator(store: Store): Manipulator {
  if (singlePoint(store)) return "move";
  const m = store.modifiers;
  if (m.ctrl && !m.alt) return m.shift ? "scale" : "rotate";
  return store.manipulator;
}

/** which handles are shown, or null when there is nothing to handle */
export function gizmoMode(store: Store): Manipulator | null {
  if (store.toolMode !== "edit" || !store.selection.objects.size) return null;
  if (store.selected().some((o) => o.locked)) return null;
  if (store.selection.mode !== "object" && !selectionCount(store.selection.elements)) return null;
  return effectiveManipulator(store);
}

/** the centre of the selected elements, world space */
export function elementCenter(env: ManipEnv, o: Obj): THREE.Vector3 {
  const W = env.renderer.picker.worldVerts(o, selectedVerts(o.mesh, env.store.selection.elements));
  if (!W.length) return new THREE.Vector3().fromArray(o.pos);
  const c = new THREE.Vector3();
  for (const w of W) c.add(w);
  return c.divideScalar(W.length);
}

export function pivotOf(env: ManipEnv, objs: Obj[]): THREE.Vector3 {
  const t = env.store.editTarget();
  if (t) return elementCenter(env, t);
  if (objs.length === 1) return new THREE.Vector3().fromArray(objs[0].pos);
  const last = env.store.selection.last;
  const root = objs.find((o) => o.id === last && o.group && objs.every((p) => p.group === o.group));
  if (root) return new THREE.Vector3().fromArray(root.pos);
  return boxOf(env.renderer.views, objs).getCenter(new THREE.Vector3());
}

/** the rotation of the handles */
export function referenceQuat(env: ManipEnv, objs: Obj[]): THREE.Quaternion {
  const axes = env.store.settings.axes;
  const t = env.store.editTarget();
  if (t) {
    if (axes === "normal") return elementNormalQuat(env, t);
    return axes === "local" ? new THREE.Quaternion().fromArray(t.quat) : new THREE.Quaternion();
  }
  if (axes !== "world" && objs.length === 1) return new THREE.Quaternion().fromArray(objs[0].quat);
  return new THREE.Quaternion();
}

/** Z along the average normal of the selected faces (or the faces around the selected vertices) */
function elementNormalQuat(env: ManipEnv, o: Obj): THREE.Quaternion {
  const m = o.mesh;
  const sel = env.store.selection.elements;
  let faces = [...selectedFaces(m, sel)];
  if (!faces.length) {
    const around = new Set<number>();
    const vertFaces = topologyOf(m).vertFaces;
    for (const v of selectedVerts(m, sel)) for (const f of vertFaces[v]) around.add(f);
    faces = [...around];
  }
  const n = new THREE.Vector3();
  for (const f of faces) n.add(new THREE.Vector3().fromArray(faceNormal(m, m.f[f])));
  const M = env.renderer.views.worldMatrixOf(o);
  if (n.lengthSq() < 1e-12 || !M) return new THREE.Quaternion().fromArray(o.quat);
  n.applyMatrix3(new THREE.Matrix3().getNormalMatrix(M)).normalize();
  return new THREE.Quaternion().setFromUnitVectors(new THREE.Vector3(0, 0, 1), n);
}
