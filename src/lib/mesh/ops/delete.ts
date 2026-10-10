import type { Mesh } from "../mesh";
import { invalidateTopology, topologyOf } from "../topology";
import { dropOrphans, removeFaces } from "./rewrite";

/** Removing elements. Vertices left without faces go too. */
export function deleteFaces(m: Mesh, faces: Set<number>): void {
  removeFaces(m, faces);
  dropOrphans(m);
  invalidateTopology(m);
}

export function deleteVerts(m: Mesh, verts: Set<number>): void {
  const t = topologyOf(m);
  const faces = new Set<number>();
  for (const v of verts) for (const f of t.vertFaces[v]) faces.add(f);
  deleteFaces(m, faces);
}

export function deleteEdges(m: Mesh, edges: Set<string>): void {
  const t = topologyOf(m);
  const faces = new Set<number>();
  for (const k of edges) for (const f of t.edges.get(k)?.faces ?? []) faces.add(f);
  deleteFaces(m, faces);
}

/** Move faces into a new mesh (and remove them from this one). */
export function extract(m: Mesh, faces: Set<number>): Mesh {
  const used = new Map<number, number>();
  const out: Mesh = { v: [], f: [], fm: [] };
  const vertex = (i: number): number => {
    let j = used.get(i);
    if (j === undefined) {
      j = out.v.length;
      used.set(i, j);
      out.v.push([...m.v[i]]);
    }
    return j;
  };
  for (const fi of faces) {
    out.f.push(m.f[fi].map(vertex));
    out.fm.push(m.fm[fi]);
  }
  deleteFaces(m, faces);
  return out;
}
