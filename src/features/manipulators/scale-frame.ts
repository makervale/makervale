/** The stretch handles: a box around what is selected, with a handle on each corner and each face. */
import * as THREE from "three";
import { selectedVerts } from "@/lib/mesh/selection";
import type { Obj } from "@/world/model";
import { boxOf } from "@/render/camera/framing";
import type { Theme } from "@/render/theme";
import type { ManipEnv } from "./env";
import { axisColor } from "./gizmo-parts";
import { handleMaterial, handleOf, registerHandle } from "./handle";
import { referenceQuat } from "./reference";

/** a box in the world: centre, rotation, size in metres */
export interface FrameBox {
  center: THREE.Vector3;
  q: THREE.Quaternion;
  size: THREE.Vector3;
}

export interface ScaleFrame extends FrameBox {
  /** one object: stretching changes its size, not just positions */
  single: boolean;
  /** where that object's origin is (its mesh may not be centred on it) */
  objCenter: THREE.Vector3;
}

const MIN_ELEMENT_BOX_M = 0.02;
const MIN_OBJECT_BOX_M = 1e-3;
const HANDLE_PX = 9;
const HOVER_GROW = 1.35;
const FACE_HANDLE_GROW = 1.1;

/** the object's mesh bounds in its own axes, in metres, and their centre in world space */
function meshBounds(o: Obj): { size: THREE.Vector3; center: THREE.Vector3 } {
  const b = new THREE.Box3();
  for (const v of o.mesh.v) b.expandByPoint(new THREE.Vector3().fromArray(v));
  const s = b.getSize(new THREE.Vector3()).multiply(new THREE.Vector3().fromArray(o.size));
  const c = b.getCenter(new THREE.Vector3()).multiply(new THREE.Vector3().fromArray(o.size));
  const floor = new THREE.Vector3().setScalar(MIN_OBJECT_BOX_M);
  return { size: s.max(floor), center: c.applyQuaternion(new THREE.Quaternion().fromArray(o.quat)) };
}

function elementFrame(env: ManipEnv, t: Obj, objs: Obj[]): ScaleFrame {
  const M = env.renderer.views.worldMatrixOf(t) ?? new THREE.Matrix4();
  const q = referenceQuat(env, objs);
  const qi = q.clone().invert();
  const b = new THREE.Box3();
  for (const i of selectedVerts(t.mesh, env.store.selection.elements)) {
    b.expandByPoint(new THREE.Vector3().fromArray(t.mesh.v[i]).applyMatrix4(M).applyQuaternion(qi));
  }
  const center = b.getCenter(new THREE.Vector3()).applyQuaternion(q);
  const size = b.getSize(new THREE.Vector3()).max(new THREE.Vector3().setScalar(MIN_ELEMENT_BOX_M));
  return { center, q, size, single: false, objCenter: center.clone() };
}

/** the box the stretch handles sit on: selected elements, one object's mesh, or all selected objects */
export function scaleFrameOf(env: ManipEnv, objs: Obj[]): ScaleFrame {
  const t = env.store.editTarget();
  if (t) return elementFrame(env, t, objs);
  if (objs.length === 1) {
    const o = objs[0];
    const objCenter = new THREE.Vector3().fromArray(o.pos);
    const { size, center } = meshBounds(o);
    return {
      center: center.add(objCenter),
      q: new THREE.Quaternion().fromArray(o.quat),
      size,
      single: true,
      objCenter,
    };
  }
  const b = boxOf(env.renderer.views, objs);
  const center = b.getCenter(new THREE.Vector3());
  return { center, q: new THREE.Quaternion(), size: b.getSize(new THREE.Vector3()), single: false, objCenter: center };
}

export interface ScaleParts {
  group: THREE.Group;
  frame: THREE.LineSegments;
  items: THREE.Mesh[];
}

export function buildScaleParts(theme: Theme, handles: THREE.Mesh[]): ScaleParts {
  const group = new THREE.Group();
  const edges = new THREE.EdgesGeometry(new THREE.BoxGeometry(1, 1, 1));
  const lines = new THREE.LineBasicMaterial({ color: theme.accent, depthTest: false, transparent: true, opacity: 0.8 });
  const frame = new THREE.LineSegments(edges, lines);
  group.add(frame);
  const items: THREE.Mesh[] = [];
  const add = (color: string, data: Parameters<typeof registerHandle>[2]) => {
    const m = new THREE.Mesh(new THREE.BoxGeometry(1, 1, 1), handleMaterial(color));
    group.add(registerHandle(handles, m, data));
    items.push(m);
  };
  for (const sx of [-1, 1]) for (const sy of [-1, 1]) for (const sz of [-1, 1]) add(theme.accent, corner(sx, sy, sz));
  for (let i = 0; i < 3; i++) for (const sign of [-1, 1]) add(axisColor(theme, i), face(i, sign));
  return { group, frame, items };
}

const corner = (sx: number, sy: number, sz: number) => ({
  kind: "corner" as const,
  axis: -1,
  s: [sx, sy, sz] as [number, number, number],
});

function face(axis: number, sign: number) {
  const s: [number, number, number] = [0, 0, 0];
  s[axis] = sign;
  return { kind: "face" as const, axis, sign, s };
}

/** a point on the box: (-1…1) per axis */
export const pointOnBox = (box: FrameBox, s: readonly number[]): THREE.Vector3 =>
  new THREE.Vector3((s[0] * box.size.x) / 2, (s[1] * box.size.y) / 2, (s[2] * box.size.z) / 2)
    .applyQuaternion(box.q)
    .add(box.center);

/** per frame: fit the box and keep the handles the same size on screen */
export function placeScaleParts(
  parts: ScaleParts,
  box: FrameBox,
  pixelSize: (p: THREE.Vector3) => number,
  hover: THREE.Object3D | null,
): void {
  parts.frame.position.copy(box.center);
  parts.frame.quaternion.copy(box.q);
  parts.frame.scale.copy(box.size).max(new THREE.Vector3().setScalar(MIN_OBJECT_BOX_M));
  for (const m of parts.items) {
    const h = handleOf(m);
    const at = pointOnBox(box, h.s ?? [0, 0, 0]);
    m.position.copy(at);
    m.quaternion.copy(box.q);
    const grow = (m === hover ? HOVER_GROW : 1) * (h.kind === "face" ? FACE_HANDLE_GROW : 1);
    m.scale.setScalar(pixelSize(at) * HANDLE_PX * grow);
  }
}
