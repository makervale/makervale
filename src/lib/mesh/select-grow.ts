import type { Mesh } from "./mesh";
import { edgeKey, parseEdgeKey } from "./mesh";
import type { EditMode, ElementSelection } from "./selection";
import { cloneSelection, emptySelection, selectedVerts } from "./selection";
import { topologyOf } from "./topology";

/** Queries that grow, shrink or flip an element selection. */

/** everything connected to the selection, in the same element types the selection uses */
export function linked(m: Mesh, s: ElementSelection): ElementSelection {
  const t = topologyOf(m);
  const seen = new Set<number>();
  const stack = [...selectedVerts(m, s)];
  while (stack.length) {
    const v = stack.pop()!;
    if (seen.has(v)) continue;
    seen.add(v);
    for (const n of t.vertNbrs[v]) if (!seen.has(n)) stack.push(n);
  }
  const out = emptySelection();
  if (s.faces.size) {
    m.f.forEach((face, i) => {
      if (seen.has(face[0])) out.faces.add(i);
    });
  }
  if (s.edges.size) for (const [k, e] of t.edges) if (seen.has(e.a)) out.edges.add(k);
  if (s.verts.size) for (const v of seen) out.verts.add(v);
  return out;
}

export function grow(m: Mesh, s: ElementSelection): ElementSelection {
  const t = topologyOf(m);
  const out = cloneSelection(s);
  for (const v of s.verts) for (const n of t.vertNbrs[v]) out.verts.add(n);
  const edgeVerts = new Set<number>();
  for (const k of s.edges) for (const v of parseEdgeKey(k)) edgeVerts.add(v);
  for (const v of edgeVerts) for (const n of t.vertNbrs[v]) out.edges.add(edgeKey(v, n));
  const faceVerts = new Set<number>();
  for (const f of s.faces) for (const v of m.f[f]) faceVerts.add(v);
  for (const v of faceVerts) for (const f of t.vertFaces[v]) out.faces.add(f);
  return out;
}

function shrinkFaces(m: Mesh, s: ElementSelection, out: ElementSelection): void {
  const t = topologyOf(m);
  const rim = new Set<number>();
  for (const f of s.faces) {
    for (const v of m.f[f]) if (t.vertFaces[v].some((g) => !s.faces.has(g))) rim.add(v);
  }
  for (const f of s.faces) if (m.f[f].some((v) => rim.has(v))) out.faces.delete(f);
}

function shrinkEdges(s: ElementSelection, out: ElementSelection): void {
  const count = new Map<number, number>();
  for (const k of s.edges) for (const v of parseEdgeKey(k)) count.set(v, (count.get(v) ?? 0) + 1);
  for (const k of s.edges) if (parseEdgeKey(k).some((v) => count.get(v) === 1)) out.edges.delete(k);
}

export function shrink(m: Mesh, s: ElementSelection): ElementSelection {
  const t = topologyOf(m);
  const out = cloneSelection(s);
  for (const v of s.verts) {
    if (t.vertNbrs[v].some((n) => !s.verts.has(n)) || t.isBoundaryVert(v)) out.verts.delete(v);
  }
  shrinkFaces(m, s, out);
  shrinkEdges(s, out);
  return out;
}

function dominantKind(s: ElementSelection): EditMode {
  if (s.faces.size) return "face";
  if (s.edges.size) return "edge";
  return "vert";
}

export function invertSelection(m: Mesh, s: ElementSelection, mode: EditMode): ElementSelection {
  const out = emptySelection();
  const kind = mode === "auto" ? dominantKind(s) : mode;
  if (kind === "vert") {
    for (let i = 0; i < m.v.length; i++) if (!s.verts.has(i)) out.verts.add(i);
  } else if (kind === "edge") {
    for (const k of topologyOf(m).edges.keys()) if (!s.edges.has(k)) out.edges.add(k);
  } else {
    for (let i = 0; i < m.f.length; i++) if (!s.faces.has(i)) out.faces.add(i);
  }
  return out;
}

export function boundaryEdges(m: Mesh): Set<string> {
  const out = new Set<string>();
  for (const [k, e] of topologyOf(m).edges) if (e.faces.length === 1) out.add(k);
  return out;
}

export function facesByMaterial(m: Mesh, slot: number): Set<number> {
  const out = new Set<number>();
  m.fm.forEach((s, i) => {
    if (s === slot) out.add(i);
  });
  return out;
}
