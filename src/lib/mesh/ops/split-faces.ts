import type { Mesh } from "../mesh";
import type { ElementSelection } from "../selection";
import { facesSelection } from "../selection-of";
import { invalidateTopology, topologyOf } from "../topology";

/** Detach faces from the rest: vertices shared with unselected faces are duplicated for the region. */
export function splitFaces(m: Mesh, faces: Set<number>): ElementSelection {
  const t = topologyOf(m);
  const copies = new Map<number, number>();
  for (const fi of faces) {
    for (const v of m.f[fi]) {
      if (copies.has(v) || t.vertFaces[v].every((f) => faces.has(f))) continue;
      copies.set(v, m.v.length);
      m.v.push([...m.v[v]]);
    }
  }
  for (const fi of faces) m.f[fi] = m.f[fi].map((v) => copies.get(v) ?? v);
  invalidateTopology(m);
  return facesSelection(faces);
}
