import type { Vec3 } from "../vec";
import { cross, length, sub } from "../vec";
import type { Mesh } from "./mesh";
import { weld } from "./ops/merge";
import { dropOrphans, remapFaces } from "./ops/rewrite";
import { fixTJunctions } from "./t-junctions";
import { invalidateTopology } from "./topology";

/** Clean-up used after booleans and imports: a triangle soup becomes a welded mesh. */

function soupMesh(pos: ArrayLike<number>, index: ArrayLike<number> | null, triMat?: ArrayLike<number>): Mesh {
  const v: Vec3[] = [];
  for (let i = 0; i + 2 < pos.length; i += 3) v.push([pos[i], pos[i + 1], pos[i + 2]]);
  const triangles = index ? Math.floor(index.length / 3) : Math.floor(v.length / 3);
  const m: Mesh = { v, f: [], fm: [] };
  for (let t = 0; t < triangles; t++) {
    m.f.push(index ? [index[t * 3], index[t * 3 + 1], index[t * 3 + 2]] : [t * 3, t * 3 + 1, t * 3 + 2]);
    m.fm.push(triMat ? triMat[t] | 0 : 0);
  }
  return m;
}

/** is the triangle's height over its longest edge above eps? */
function isFat(m: Mesh, [a, b, c]: number[], eps: number): boolean {
  const [pa, pb, pc] = [m.v[a], m.v[b], m.v[c]];
  const longest = Math.max(length(sub(pb, pa)), length(sub(pc, pb)), length(sub(pa, pc)));
  return longest > 0 && length(cross(sub(pb, pa), sub(pc, pa))) / longest > eps;
}

/**
 * Triangle soup (optionally indexed, optionally with a material slot per triangle) → welded mesh,
 * degenerate triangles removed and T-junctions closed. The winding is kept as given.
 */
export function fromTriangles(
  pos: ArrayLike<number>,
  index: ArrayLike<number> | null,
  triMat?: ArrayLike<number>,
  weldEps = 1e-5,
): Mesh {
  const m = soupMesh(pos, index, triMat);
  // welding also drops triangles that collapsed onto a repeated vertex
  weld(m, weldEps);
  // slivers thinner than the weld distance go; fixTJunctions closes the gap they leave
  const keep = m.f.map((face) => isFat(m, face, weldEps));
  m.f = m.f.filter((_, i) => keep[i]);
  m.fm = m.fm.filter((_, i) => keep[i]);
  dropOrphans(m);
  invalidateTopology(m);
  fixTJunctions(m, weldEps);
  remapFaces(m, (i) => i);
  invalidateTopology(m);
  return m;
}
