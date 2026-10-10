import type { Vec3 } from "../vec";
import type { Mesh, UV } from "./mesh";
import { faceNormal, hasUV } from "./mesh";
import type { Topology } from "./topology";
import { topologyOf } from "./topology";
import { triangulatePoly } from "./triangulate";

/**
 * Mesh → render buffers (no three.js): one vertex block per polygon, one draw group per material slot,
 * normals smoothed across edges flatter than the smoothing angle.
 */

/**
 * triPoly is in build order (a BVH may reorder the index later); vertPoly maps every render vertex to its
 * polygon and stays valid because each polygon owns its own vertex block. Picking must use vertPoly.
 */
export interface BuiltInfo {
  triPoly: Int32Array;
  vertPoly: Int32Array;
  /** material slots the mesh uses (at least 1) */
  slots: number;
  /** some edge has other than two faces */
  open: boolean;
}

export interface GeometryGroup {
  start: number;
  count: number;
  materialIndex: number;
}

export interface GeometryData {
  position: Float32Array;
  normal: Float32Array;
  uv: Float32Array;
  index: Uint32Array;
  groups: GeometryGroup[];
  info: BuiltInfo;
}

interface Buffers {
  pos: number[];
  nrm: number[];
  uv: number[];
  index: number[];
  triPoly: number[];
  vertPoly: number[];
  groups: GeometryGroup[];
}

interface Shading {
  t: Topology;
  normals: Vec3[];
  minCos: number;
  size: Vec3;
  /** the stored UVs when they fit the faces; otherwise a box projection is used */
  uv: UV[][] | null;
}

/** the vertex normal for vi as seen from a face with normal n: neighbours within the angle blend in */
function smoothNormal(vi: number, n: Vec3, { t, normals, minCos }: Shading): Vec3 {
  let [sx, sy, sz] = [0, 0, 0];
  for (const g of t.vertFaces[vi]) {
    const q = normals[g];
    if (q[0] * n[0] + q[1] * n[1] + q[2] * n[2] <= minCos) continue;
    sx += q[0];
    sy += q[1];
    sz += q[2];
  }
  const l = Math.hypot(sx, sy, sz) || 1;
  return [sx / l, sy / l, sz / l];
}

/** box projection in metres along the face's dominant axis, so patterns tile at real scale */
function boxProjection(v: Vec3, n: Vec3, size: Vec3): [number, number] {
  const [ax, ay, az] = [Math.abs(n[0]), Math.abs(n[1]), Math.abs(n[2])];
  if (az >= ax && az >= ay) return [v[0] * size[0], v[1] * size[1]];
  if (ax >= ay) return [v[1] * size[1], v[2] * size[2]];
  return [v[0] * size[0], v[2] * size[2]];
}

function addPolygon(m: Mesh, fi: number, b: Buffers, shading: Shading): void {
  const face = m.f[fi];
  const n = shading.normals[fi];
  const base = b.pos.length / 3;
  const local = new Map<number, number>();
  const stored = shading.uv?.[fi];
  face.forEach((vi, k) => {
    local.set(vi, base + k);
    b.vertPoly.push(fi);
    const v = m.v[vi];
    b.pos.push(v[0], v[1], v[2]);
    b.nrm.push(...smoothNormal(vi, n, shading));
    b.uv.push(...(stored ? stored[k] : boxProjection(v, n, shading.size)));
  });
  for (const tri of triangulatePoly(m, face)) {
    b.index.push(local.get(tri[0])!, local.get(tri[1])!, local.get(tri[2])!);
    b.triPoly.push(fi);
  }
}

/** polygons sorted by slot (stable), each slot run becoming one draw group */
function fillBuffers(m: Mesh, shading: Shading): Buffers {
  const b: Buffers = { pos: [], nrm: [], uv: [], index: [], triPoly: [], vertPoly: [], groups: [] };
  const order = m.f.map((_, i) => i).sort((a, c) => m.fm[a] - m.fm[c] || a - c);
  for (const fi of order) {
    const last = b.groups[b.groups.length - 1];
    if (!last || last.materialIndex !== m.fm[fi])
      b.groups.push({ start: b.index.length, count: 0, materialIndex: m.fm[fi] });
    addPolygon(m, fi, b, shading);
    const group = b.groups[b.groups.length - 1];
    group.count = b.index.length - group.start;
  }
  return b;
}

export function buildGeometryData(mesh: Mesh, smoothAngleDegrees: number, size: Vec3): GeometryData {
  const t = topologyOf(mesh);
  const shading: Shading = {
    t,
    normals: mesh.f.map((face) => faceNormal(mesh, face)),
    minCos: Math.cos((smoothAngleDegrees * Math.PI) / 180),
    size,
    uv: hasUV(mesh) ? mesh.uv! : null,
  };
  const b = fillBuffers(mesh, shading);
  let slots = 1;
  for (const s of mesh.fm) slots = Math.max(slots, s + 1);
  return {
    position: Float32Array.from(b.pos),
    normal: Float32Array.from(b.nrm),
    uv: Float32Array.from(b.uv),
    index: Uint32Array.from(b.index),
    groups: b.groups,
    info: {
      triPoly: Int32Array.from(b.triPoly),
      vertPoly: Int32Array.from(b.vertPoly),
      slots,
      open: [...t.edges.values()].some((e) => e.faces.length !== 2),
    },
  };
}
