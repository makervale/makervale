import * as THREE from "three";
import type { CSGOperation } from "three-bvh-csg";
import { ADDITION, Brush, Evaluator, INTERSECTION, SUBTRACTION } from "three-bvh-csg";
import type { Mesh } from "./mesh";
import { triangulatePoly } from "./triangulate";

/** three-bvh-csg glue: meshes in, a triangle soup with a material slot per triangle out. */
export type BoolOp = "union" | "subtract" | "intersect";

const OPERATIONS: Record<BoolOp, CSGOperation> = { union: ADDITION, subtract: SUBTRACTION, intersect: INTERSECTION };

export interface TriangleSoup {
  pos: ArrayLike<number>;
  index: ArrayLike<number> | null;
  triSlot: Int32Array;
}

/** indexed triangle geometry with one group per material slot; each group's material carries slot + offset */
function toBrush(m: Mesh, slotOffset: number): Brush {
  const pos = new Float32Array(m.v.length * 3);
  m.v.forEach((p, i) => pos.set(p, i * 3));
  const order = m.f.map((_, i) => i).sort((a, b) => m.fm[a] - m.fm[b]);
  const g = new THREE.BufferGeometry();
  const index: number[] = [];
  const materials: THREE.Material[] = [];
  let start = 0;
  const closeGroup = (): void => {
    if (materials.length && index.length > start) g.addGroup(start, index.length - start, materials.length - 1);
  };
  for (const fi of order) {
    if (!materials.length || materials[materials.length - 1].userData.slot !== m.fm[fi] + slotOffset) {
      closeGroup();
      start = index.length;
      const mat = new THREE.MeshBasicMaterial();
      mat.userData.slot = m.fm[fi] + slotOffset;
      materials.push(mat);
    }
    for (const t of triangulatePoly(m, m.f[fi])) index.push(t[0], t[1], t[2]);
  }
  closeGroup();
  g.setAttribute("position", new THREE.BufferAttribute(pos, 3));
  g.setIndex(index);
  const brush = new Brush(g, materials);
  brush.updateMatrixWorld();
  return brush;
}

/** the slot of every result triangle, read from its group's material */
function triangleSlots(g: THREE.BufferGeometry, materials: THREE.Material[], count: number): Int32Array {
  const slots = new Int32Array(count);
  const groups = g.groups.length ? g.groups : [{ start: 0, count: count * 3, materialIndex: 0 }];
  for (const gr of groups) {
    const slot = materials[gr.materialIndex ?? 0]?.userData.slot ?? 0;
    for (let t = gr.start / 3; t < Math.min(count, (gr.start + gr.count) / 3); t++) slots[t] = slot;
  }
  return slots;
}

/** run the CSG on two meshes already in the same space */
export function csg(a: Mesh, b: Mesh, op: BoolOp, bSlotOffset: number): TriangleSoup {
  const ev = new Evaluator();
  ev.attributes = ["position"];
  ev.useGroups = true;
  const result = ev.evaluate(toBrush(a, 0), toBrush(b, bSlotOffset), OPERATIONS[op]);
  const g = result.geometry;
  const pos = g.getAttribute("position").array as Float32Array;
  const index = g.index ? g.index.array : null;
  const count = (index ? index.length : pos.length / 3) / 3;
  const materials = (Array.isArray(result.material) ? result.material : [result.material]) as THREE.Material[];
  const triSlot = triangleSlots(g, materials, count);
  for (const mt of materials) mt.dispose();
  g.dispose();
  return { pos, index, triSlot };
}
