import type { Mat4 } from "./affine";
import { invertAffine, transformMesh } from "./affine";
import type { BoolOp } from "./boolean-csg";
import { csg } from "./boolean-csg";
import { boundsOf, boundsOverlap, diagonalOf, unionBounds } from "./bounds";
import { fromTriangles } from "./cleanup";
import { limitedDissolve } from "./limited-dissolve";
import type { Mesh } from "./mesh";
import { append } from "./ops/append";
import { weld } from "./ops/merge";
import { recalcNormals } from "./ops/normals";
import { fixTJunctions } from "./t-junctions";
import { inspect } from "./validate";

export type { BoolOp } from "./boolean-csg";

/** A mesh with its placement (object space → world), e.g. `composeMatrix(obj.pos, obj.quat, obj.size)`. */
export interface Placed {
  mesh: Mesh;
  matrix: Mat4;
}

/** clean-up tolerance: tiny relative to the scene, in metres */
const RELATIVE_EPS = 2e-6;
const MIN_EPS = 1e-6;
/** coplanar triangles of the result merge back into polygons within this angle */
const DISSOLVE_DEG = 0.5;

/**
 * Union / subtract / intersect two placed meshes. The CSG runs in world space; its triangle soup is
 * welded, T-junction-repaired and dissolved back into polygons (so tolerances are metres and angles are
 * true), then expressed in A's object space. Returns a NEW mesh; B's slots are shifted by `bSlotOffset`.
 */
export function booleanOp(a: Placed, b: Placed, op: BoolOp, bSlotOffset: number): Mesh {
  const worldA = transformMesh(a.mesh, a.matrix);
  const worldB = transformMesh(b.mesh, b.matrix);
  const toA = invertAffine(a.matrix);
  const boundsA = boundsOf(worldA.v);
  const boundsB = boundsOf(worldB.v);
  if (!boundsOverlap(boundsA, boundsB)) {
    if (op !== "union") throw new Error("The solids do not overlap");
    const out = transformMesh(worldA, toA);
    append(out, transformMesh(worldB, toA), bSlotOffset);
    return out;
  }
  const soup = csg(worldA, worldB, op, bSlotOffset);
  const eps = Math.max(MIN_EPS, diagonalOf(unionBounds(boundsA, boundsB)) * RELATIVE_EPS);
  const m = fromTriangles(soup.pos, soup.index, soup.triSlot, eps);
  weld(m, eps);
  fixTJunctions(m, eps);
  limitedDissolve(m, DISSOLVE_DEG);
  const out = transformMesh(m, toA);
  const r = inspect(out);
  if (r.flipped.length || (r.closed && r.volume < 0)) recalcNormals(out);
  return out;
}
