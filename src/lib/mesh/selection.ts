import type { Mesh } from "./mesh";
import { edgeKey, parseEdgeKey } from "./mesh";

/** Which elements of one mesh are selected. Edges are keyed "a_b" with a < b (see edgeKey). */
export interface ElementSelection {
  verts: Set<number>;
  edges: Set<string>;
  faces: Set<number>;
}

export type EditMode = "object" | "auto" | "vert" | "edge" | "face";

export const emptySelection = (): ElementSelection => ({ verts: new Set(), edges: new Set(), faces: new Set() });

export const cloneSelection = (s: ElementSelection): ElementSelection => ({
  verts: new Set(s.verts),
  edges: new Set(s.edges),
  faces: new Set(s.faces),
});

export const selectionCount = (s: ElementSelection): number => s.verts.size + s.edges.size + s.faces.size;

/** every vertex the selection touches, through edges and faces too */
export function selectedVerts(m: Mesh, s: ElementSelection): Set<number> {
  const out = new Set(s.verts);
  for (const key of s.edges) for (const v of parseEdgeKey(key)) out.add(v);
  for (const fi of s.faces) for (const v of m.f[fi] ?? []) out.add(v);
  return out;
}

/** explicitly selected faces, or faces whose vertices are all selected */
export function selectedFaces(m: Mesh, s: ElementSelection): Set<number> {
  if (s.faces.size) return new Set(s.faces);
  const verts = selectedVerts(m, s);
  const out = new Set<number>();
  if (verts.size < 3) return out;
  m.f.forEach((face, i) => {
    if (face.every((v) => verts.has(v))) out.add(i);
  });
  return out;
}

/** explicitly selected edges, or edges with both ends selected */
export function selectedEdges(m: Mesh, s: ElementSelection): Set<string> {
  if (s.edges.size) return new Set(s.edges);
  const verts = selectedVerts(m, s);
  const out = new Set<string>();
  for (const face of m.f) {
    for (let i = 0; i < face.length; i++) {
      const a = face[i];
      const b = face[(i + 1) % face.length];
      if (verts.has(a) && verts.has(b)) out.add(edgeKey(a, b));
    }
  }
  return out;
}

/** the same selection expressed in one element type, for when the mode changes */
export function convertSelection(m: Mesh, s: ElementSelection, mode: EditMode): ElementSelection {
  const out = emptySelection();
  if (mode === "auto") return cloneSelection(s);
  if (mode === "vert") out.verts = selectedVerts(m, s);
  if (mode === "edge") out.edges = selectedEdges(m, s);
  if (mode === "face") out.faces = selectedFaces(m, s);
  return out;
}
