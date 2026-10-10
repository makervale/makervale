import type { Vec3 } from "../../vec";
import { add, scale } from "../../vec";
import type { Mesh } from "../mesh";
import { edgeKey, faceCenter } from "../mesh";
import { average } from "../points";
import type { Topology } from "../topology";
import { invalidateTopology, topologyOf } from "../topology";

/** One Catmull-Clark step. Boundaries stay put (they only get smoothed along themselves). */

/** one new vertex per edge: the average of its ends and its two face points */
function edgePoints(m: Mesh, t: Topology, facePoints: Vec3[]): Map<string, number> {
  const idx = new Map<string, number>();
  for (const [k, e] of t.edges) {
    const pts = [m.v[e.a], m.v[e.b]];
    if (e.faces.length === 2) for (const f of e.faces) pts.push(facePoints[f]);
    m.v.push(average(pts));
    idx.set(k, m.v.length - 1);
  }
  return idx;
}

function boundaryPosition(m: Mesh, t: Topology, vi: number): Vec3 {
  const p = m.v[vi];
  const nbrs = t.vertNbrs[vi].filter((j) => t.isBoundaryEdge(vi, j));
  if (nbrs.length !== 2) return [...p];
  const a = m.v[nbrs[0]];
  const b = m.v[nbrs[1]];
  return add(scale(p, 0.75), scale(add(a, b), 0.125));
}

function interiorPosition(m: Mesh, t: Topology, vi: number, facePoints: Vec3[]): Vec3 {
  const p = m.v[vi];
  const faces = t.vertFaces[vi];
  const n = faces.length;
  const f = average(faces.map((fi) => facePoints[fi]));
  const r = average(t.vertNbrs[vi].map((j) => scale(add(m.v[j], p), 0.5)));
  return scale(add(add(f, scale(r, 2)), scale(p, n - 3)), 1 / n);
}

function movedOriginals(m: Mesh, t: Topology, count: number, facePoints: Vec3[]): Vec3[] {
  const out: Vec3[] = [];
  for (let vi = 0; vi < count; vi++) {
    if (!t.vertFaces[vi].length) out.push(m.v[vi]);
    else if (t.isBoundaryVert(vi)) out.push(boundaryPosition(m, t, vi));
    else out.push(interiorPosition(m, t, vi, facePoints));
  }
  return out;
}

export function subdivide(m: Mesh): void {
  const t = topologyOf(m);
  const facePoints = m.f.map((face) => faceCenter(m, face));
  const originals = m.v.length;
  const faceIdx = facePoints.map((c) => {
    m.v.push(c);
    return m.v.length - 1;
  });
  const edgeIdx = edgePoints(m, t, facePoints);
  const moved = movedOriginals(m, t, originals, facePoints);
  for (let vi = 0; vi < originals; vi++) m.v[vi] = moved[vi];
  const f: number[][] = [];
  const fm: number[] = [];
  m.f.forEach((face, fi) => {
    const len = face.length;
    for (let i = 0; i < len; i++) {
      const a = face[i];
      const next = edgeIdx.get(edgeKey(a, face[(i + 1) % len]))!;
      const prev = edgeIdx.get(edgeKey(face[(i - 1 + len) % len], a))!;
      f.push([a, next, faceIdx[fi], prev]);
      fm.push(m.fm[fi]);
    }
  });
  m.f = f;
  m.fm = fm;
  invalidateTopology(m);
}
