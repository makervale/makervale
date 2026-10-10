import type { Vec3 } from "../../vec";
import { boundsOf } from "../bounds";
import type { Mesh } from "../mesh";
import { cloneMesh } from "../mesh";

/** axes thinner than this are flat */
const FLAT_EXTENT = 1e-6;
/** the size a flat axis gets */
const FLAT_SIZE = 1e-3;

/**
 * Recentre and rescale into the editor's unit space [-0.5, 0.5]³: pos = bounding-box centre,
 * size = extents. Flat axes get size 1e-3 and coordinate 0. Returns a copy (UVs kept).
 */
export function normaliseForEditor(m: Mesh): { mesh: Mesh; pos: Vec3; size: Vec3 } {
  const b = m.v.length ? boundsOf(m.v) : { lo: [0, 0, 0], hi: [0, 0, 0] };
  const pos: Vec3 = [0, 1, 2].map((k) => (b.lo[k] + b.hi[k]) / 2) as Vec3;
  const flat = [0, 1, 2].map((k) => b.hi[k] - b.lo[k] < FLAT_EXTENT);
  const size: Vec3 = [0, 1, 2].map((k) => (flat[k] ? FLAT_SIZE : b.hi[k] - b.lo[k])) as Vec3;
  const mesh = cloneMesh(m);
  if (m.uv && !mesh.uv) mesh.uv = m.uv.map((face) => face.map((q): [number, number] => [q[0], q[1]]));
  mesh.v = m.v.map((p) => [0, 1, 2].map((k) => (flat[k] ? 0 : (p[k] - pos[k]) / size[k])) as Vec3);
  return { mesh, pos, size };
}
