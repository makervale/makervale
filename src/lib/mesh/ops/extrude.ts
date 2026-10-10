import type { Vec3 } from "../../vec";
import { add, normalize } from "../../vec";
import type { Mesh } from "../mesh";
import { edgeKey, faceNormal } from "../mesh";
import type { ElementSelection } from "../selection";
import { edgesSelection, facesSelection } from "../selection-of";
import { edgeDirection, invalidateTopology, topologyOf } from "../topology";

/** a lazily duplicated copy of each vertex, appended to the mesh */
export function vertexDuplicator(m: Mesh): (vi: number) => number {
  const dup = new Map<number, number>();
  return (vi) => {
    let j = dup.get(vi);
    if (j === undefined) {
      j = m.v.length;
      m.v.push([...m.v[vi]]);
      dup.set(vi, j);
    }
    return j;
  };
}

/** Pull faces out: the region gets fresh vertices and side walls along its border. */
export function extrude(m: Mesh, faces: Set<number>): ElementSelection {
  const t = topologyOf(m);
  const fresh = vertexDuplicator(m);
  const sides: number[][] = [];
  const slots: number[] = [];
  for (const fi of faces) {
    const face = m.f[fi];
    for (let k = 0; k < face.length; k++) {
      const a = face[k];
      const b = face[(k + 1) % face.length];
      const e = t.edges.get(edgeKey(a, b))!;
      // interior edges of the region get no wall
      if (e.faces.filter((f) => faces.has(f)).length !== 1) continue;
      sides.push([a, b, fresh(b), fresh(a)]);
      slots.push(m.fm[fi]);
    }
  }
  for (const fi of faces) m.f[fi] = m.f[fi].map(fresh);
  sides.forEach((side, i) => {
    m.f.push(side);
    m.fm.push(slots[i]);
  });
  invalidateTopology(m);
  return facesSelection(faces);
}

/** the average direction of a group of faces */
export function regionNormal(m: Mesh, faces: Iterable<number>): Vec3 {
  let n: Vec3 = [0, 0, 0];
  for (const f of faces) n = add(n, faceNormal(m, m.f[f]));
  return normalize(n);
}

/** Grow open edges into new faces. The new edge starts on top of the old one; the caller drags it. */
export function extrudeEdges(m: Mesh, edges: Set<string>): ElementSelection {
  const t = topologyOf(m);
  const fresh = vertexDuplicator(m);
  const out: string[] = [];
  for (const k of edges) {
    const e = t.edges.get(k);
    if (!e || e.faces.length !== 1) continue;
    const [a, b] = edgeDirection(m, e);
    m.f.push([b, a, fresh(a), fresh(b)]);
    m.fm.push(m.fm[e.faces[0]]);
    out.push(edgeKey(fresh(a), fresh(b)));
  }
  if (!out.length) throw new Error("Only border edges of an open mesh can be extruded");
  invalidateTopology(m);
  return edgesSelection(out);
}
