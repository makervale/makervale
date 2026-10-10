/** Object tab edits: position (of objects, or of the selected elements), size, rotation, name. */
import * as THREE from "three";
import type { ElementSelection } from "@/lib/mesh/selection";
import { selectedVerts } from "@/lib/mesh/selection";
import type { Vec3 } from "@/lib/vec";
import type { Obj } from "@/world/model";
import type { SpinPhase } from "@/ui/spinner";
import { onSpin } from "@/ui/spinner";
import type { Build, Field } from "./context";
import { eulerOf, quatOfEuler } from "./object-tab";

const axisOf = (key: string): number => +key.split(":")[1];

/** move the selected elements by `d` metres along world axis `axis` */
function moveVerts(o: Obj, sel: ElementSelection, axis: number, d: number): void {
  const m = new THREE.Matrix4().compose(
    new THREE.Vector3().fromArray(o.pos),
    new THREE.Quaternion().fromArray(o.quat),
    new THREE.Vector3().fromArray(o.size),
  );
  const inverse = m.clone().invert();
  const shift = new THREE.Vector3().setComponent(axis, d);
  for (const vi of selectedVerts(o.mesh, sel)) {
    const w = new THREE.Vector3().fromArray(o.mesh.v[vi]).applyMatrix4(m).add(shift).applyMatrix4(inverse);
    o.mesh.v[vi] = w.toArray() as Vec3;
  }
}

function onPosition(b: Build, key: string, v: number, phase: SpinPhase): void {
  const { store, manipulators } = b.deps;
  const objs = store.selected();
  if (!objs.length) return;
  const axis = axisOf(key);
  const target = store.editTarget();
  const apply = () => {
    const d = v - manipulators.pivotOf(objs).getComponent(axis);
    if (target) moveVerts(target, store.selection.elements, axis, d);
    else for (const o of objs) o.pos[axis] += d;
  };
  b.drag.step({ label: "Position", objs: target ? [target] : objs, phase, apply, mesh: !!target });
}

function onSize(b: Build, key: string, v: number, phase: SpinPhase): void {
  const o = b.deps.store.selected()[0];
  if (!o) return;
  b.drag.step({ label: "Size", objs: [o], phase, apply: () => (o.size[axisOf(key)] = v) });
}

function onRotation(b: Build, key: string, v: number, phase: SpinPhase): void {
  const o = b.deps.store.selected()[0];
  if (!o) return;
  const apply = () => {
    const r = eulerOf(o);
    r[axisOf(key)] = v;
    o.quat = quatOfEuler(r);
  };
  b.drag.step({ label: "Rotation", objs: [o], phase, apply });
}

export function wireObjectEdits(b: Build): void {
  onSpin("pos", (key, v, phase) => onPosition(b, key, v, phase));
  onSpin("size", (key, v, phase) => onSize(b, key, v, phase));
  onSpin("rot", (key, v, phase) => onRotation(b, key, v, phase));
}

export function onNameChange(b: Build, t: Field): boolean {
  const one = b.deps.store.selected()[0];
  if (t.id !== "ob-name" || !one) return false;
  b.deps.commands.act("Name", [one.id], () => (one.name = t.value.trim() || "Object"));
  return true;
}
