/** Small things many tool definitions share: picking parts of demo meshes, sizes, axes, moving points. */
import type { ParamDef, ToolContext } from "@/app/tools";
import type { Mesh } from "@/lib/mesh/mesh";
import { faceNormal } from "@/lib/mesh/mesh";
import type { ElementSelection } from "@/lib/mesh/selection";
import { topologyOf } from "@/lib/mesh/topology";
import type { Vec3 } from "@/lib/vec";
import { normalize, rotate } from "@/lib/vec";

/** the mesh being edited; tools whose need guarantees one call this */
export function meshOf(c: ToolContext): Mesh {
  if (!c.mesh) throw new Error("Select an object");
  return c.mesh;
}

export function objOf(c: ToolContext) {
  if (!c.obj) throw new Error("Select an object");
  return c.obj;
}

export const sizeOf = (c: ToolContext): Vec3 => (c.obj ? c.obj.size : [1, 1, 1]);

export const sel = (faces: number[] = [], edges: string[] = [], verts: number[] = []): ElementSelection => ({
  faces: new Set(faces),
  edges: new Set(edges),
  verts: new Set(verts),
});

export const allFaces = (m: Mesh): number[] => m.f.map((_, i) => i);

export const allVerts = (m: Mesh): number[] => m.v.map((_, i) => i);

/** faces pointing up */
export const topFaces = (m: Mesh): number[] => allFaces(m).filter((i) => faceNormal(m, m.f[i])[2] > 0.9);

/** vertices on the top of a unit shape */
export const topVerts = (m: Mesh): number[] => allVerts(m).filter((i) => m.v[i][2] > 0.49);

/** edges around the top of a unit shape */
export function topLoop(m: Mesh): string[] {
  const top = new Set(topVerts(m));
  return [...topologyOf(m).edges].filter(([, e]) => top.has(e.a) && top.has(e.b)).map(([k]) => k);
}

/** a vertical edge (for ring and loop cut demos) */
export function verticalEdge(m: Mesh): string {
  const edges = topologyOf(m).edges;
  for (const [k, e] of edges) {
    const a = m.v[e.a];
    const b = m.v[e.b];
    if (Math.abs(a[2] - b[2]) > 0.05 && Math.hypot(a[0] - b[0], a[1] - b[1]) < 1e-6) return k;
  }
  return [...edges.keys()][0];
}

export function moveVerts(m: Mesh, ids: Iterable<number>, d: Vec3): void {
  for (const i of new Set(ids)) {
    m.v[i][0] += d[0];
    m.v[i][1] += d[1];
    m.v[i][2] += d[2];
  }
}

export function moveMesh(m: Mesh, d: Vec3): Mesh {
  moveVerts(m, allVerts(m), d);
  return m;
}

export const unitAxis = (i: number): Vec3 => [i === 0 ? 1 : 0, i === 1 ? 1 : 0, i === 2 ? 1 : 0];

/** world direction of a local axis of the edited object */
export const worldAxis = (c: ToolContext, i: number): Vec3 =>
  c.obj ? normalize(rotate(unitAxis(i), c.obj.quat)) : unitAxis(i);

/** extent of the mesh in metres along each axis */
export function meshExtent(m: Mesh, size: Vec3): Vec3 {
  if (!m.v.length) return [0, 0, 0];
  const lo = [Infinity, Infinity, Infinity];
  const hi = [-Infinity, -Infinity, -Infinity];
  for (const p of m.v) {
    for (let k = 0; k < 3; k++) {
      lo[k] = Math.min(lo[k], p[k]);
      hi[k] = Math.max(hi[k], p[k]);
    }
  }
  return [0, 1, 2].map((k) => (hi[k] - lo[k]) * size[k]) as Vec3;
}

/** the average normal of the faces around a vertex */
export function vertNormal(m: Mesh, v: number): Vec3 {
  const n: Vec3 = [0, 0, 0];
  for (const f of topologyOf(m).vertFaces[v]) {
    const q = faceNormal(m, m.f[f]);
    for (let k = 0; k < 3; k++) n[k] += q[k];
  }
  const len = Math.hypot(n[0], n[1], n[2]) || 1;
  return [n[0] / len, n[1] / len, n[2] / len];
}

/** a whole-number parameter */
export const intParam = (key: string, label: string, min: number, max: number, def: number): ParamDef => ({
  key,
  label,
  min,
  max,
  step: 1,
  def,
  decimals: 0,
});

export const AXIS_PARAM: ParamDef = { ...intParam("axis", "Axis", 0, 2, 2), options: ["X", "Y", "Z"] };

export const SIZE_PARAM: ParamDef = {
  key: "size",
  label: "Size",
  min: 0.05,
  max: 50,
  step: 0.05,
  def: 0.5,
  decimals: 2,
  unit: "m",
};

export const segmentsParam = (def = 24): ParamDef => intParam("seg", "Segments", 3, 128, def);
