/** Imported meshes → scene objects: bake the file's transform in, fit into unit space, keep the materials. */
import type { Mat4 } from "@/lib/mesh/affine";
import { isMirroring, transformPoint } from "@/lib/mesh/affine";
import { normaliseForEditor } from "@/lib/mesh/io";
import { limitedDissolve } from "@/lib/mesh/limited-dissolve";
import type { Mesh } from "@/lib/mesh/mesh";
import type { Obj, World } from "@/world/model";
import { ensureMaterialSlots, newObj } from "@/world/model";

export interface ImportItem {
  name: string;
  mesh: Mesh;
  /** the node's placement in the file (glTF); none for OBJ and STL */
  matrix: Mat4 | null;
  materials: { name: string; color: string }[];
}

/** past this many faces a mesh is simplified on import, merging coplanar triangles into polygons */
const DISSOLVE_ABOVE_FACES = 20000;
const DISSOLVE_DEG = 0.5;

/** the transform applied to the vertices; a mirroring one also flips every face so normals stay outward */
export function bakeTransform(mesh: Mesh, matrix: Mat4 | null): Mesh {
  if (!matrix) return mesh;
  const out: Mesh = { ...mesh, v: mesh.v.map((p) => transformPoint(matrix, p)) };
  if (isMirroring(matrix)) {
    out.f = mesh.f.map((face) => face.slice().reverse());
    if (mesh.uv) out.uv = mesh.uv.map((face) => face.slice().reverse());
  }
  return out;
}

function objectOf(world: World, item: ImportItem, fallbackName: string): Obj {
  if (item.mesh.f.length > DISSOLVE_ABOVE_FACES) limitedDissolve(item.mesh, DISSOLVE_DEG);
  const fitted = normaliseForEditor(bakeTransform(item.mesh, item.matrix));
  const o = newObj(world, fitted.mesh, fitted.pos, fitted.size, { name: item.name || fallbackName });
  if (item.materials.length)
    o.materials = item.materials.map((m) => ({ ...o.materials[0], name: m.name, color: m.color }));
  ensureMaterialSlots(o);
  return o;
}

/** empty meshes are skipped; everything from one file lands in one group */
export function objectsFromItems(world: World, items: ImportItem[], fileName: string): Obj[] {
  const made = items.filter((it) => it.mesh.f.length).map((it) => objectOf(world, it, fileName));
  if (made.length > 1) {
    const group = "g" + world.seq++;
    for (const o of made) o.group = group;
  }
  return made;
}
