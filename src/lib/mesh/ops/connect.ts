import type { Mesh } from "../mesh";
import { edgeKey, parseEdgeKey } from "../mesh";
import { lerp3 } from "../points";
import type { ElementSelection } from "../selection";
import { emptySelection } from "../selection";
import { edgesSelection } from "../selection-of";
import { invalidateTopology } from "../topology";

/** Edges added or removed inside existing faces. */

/** positions i < j of the two selected corners of a face, or null unless exactly two non-adjacent ones */
function splitCorners(face: number[], verts: Set<number>): [number, number] | null {
  const idx = face.map((v, i) => (verts.has(v) ? i : -1)).filter((i) => i >= 0);
  if (idx.length !== 2) return null;
  const [i, j] = idx;
  const len = face.length;
  if ((i + 1) % len === j || (j + 1) % len === i) return null;
  return [i, j];
}

/** Split faces between pairs of selected vertices that share a face but not an edge. */
export function connectVerts(m: Mesh, verts: Set<number>): ElementSelection {
  const f: number[][] = [];
  const fm: number[] = [];
  const newEdges: string[] = [];
  m.f.forEach((face, fi) => {
    const corners = splitCorners(face, verts);
    if (!corners) {
      f.push(face);
      fm.push(m.fm[fi]);
      return;
    }
    const [i, j] = corners;
    f.push(face.slice(i, j + 1), [...face.slice(j), ...face.slice(0, i + 1)]);
    fm.push(m.fm[fi], m.fm[fi]);
    newEdges.push(edgeKey(face[i], face[j]));
  });
  m.f = f;
  m.fm = fm;
  invalidateTopology(m);
  return edgesSelection(newEdges);
}

const rotateTo = (face: number[], start: number): number[] => {
  const i = face.indexOf(start);
  return [...face.slice(i), ...face.slice(0, i)];
};

/** faces that contain the edge a-b as consecutive corners */
function facesAlongEdge(m: Mesh, a: number, b: number): number[] {
  const out: number[] = [];
  m.f.forEach((face, i) => {
    const ia = face.indexOf(a);
    const ib = face.indexOf(b);
    if (ia < 0 || ib < 0) return;
    if ((ia + 1) % face.length === ib || (ib + 1) % face.length === ia) out.push(i);
  });
  return out;
}

/** the polygon left when the edge a-b between faces A and B goes; null if it would pinch */
function mergedPolygon(faceA: number[], faceB: number[], a: number, b: number): number[] | null {
  // A runs x→y along the edge, B runs y→x
  const aFirst = faceA[(faceA.indexOf(a) + 1) % faceA.length] === b;
  const x = aFirst ? a : b;
  const y = aFirst ? b : a;
  const merged = [...rotateTo(faceA, y), ...rotateTo(faceB, x).slice(1, -1)];
  return new Set(merged).size === merged.length ? merged : null;
}

/** Remove edges between pairs of faces, merging each pair into one polygon. */
export function dissolveEdges(m: Mesh, edges: Set<string>): ElementSelection {
  for (const k of edges) {
    const [a, b] = parseEdgeKey(k);
    const pair = facesAlongEdge(m, a, b);
    if (pair.length !== 2) continue;
    const merged = mergedPolygon(m.f[pair[0]], m.f[pair[1]], a, b);
    if (!merged) continue;
    m.f[pair[0]] = merged;
    m.f.splice(pair[1], 1);
    m.fm.splice(pair[1], 1);
  }
  invalidateTopology(m);
  return emptySelection();
}

/** a new vertex at fraction `t` of the edge, spliced into every face that uses it; returns its index */
export function insertVertexOnEdge(m: Mesh, key: string, t: number): number {
  const [a, b] = parseEdgeKey(key);
  m.v.push(lerp3(m.v[a], m.v[b], Math.min(0.999, Math.max(0.001, t))));
  const c = m.v.length - 1;
  m.f = m.f.map((face) => {
    const q: number[] = [];
    for (let k = 0; k < face.length; k++) {
      const x = face[k];
      const y = face[(k + 1) % face.length];
      q.push(x);
      if ((x === a && y === b) || (x === b && y === a)) q.push(c);
    }
    return q;
  });
  invalidateTopology(m);
  return c;
}
