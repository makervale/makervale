import type { Vec3 } from "../../vec";
import { add, div3, mul3, scale } from "../../vec";
import type { Axis } from "../axis";
import { degToRad, isFullTurn, rotateAbout } from "../axis";
import type { Mesh } from "../mesh";
import { cloneMesh } from "../mesh";
import { safeSize } from "../scaled";
import type { ElementSelection } from "../selection";
import { emptySelection } from "../selection";
import { invalidateTopology } from "../topology";
import { append } from "./append";
import { weld } from "./merge";
import { dropTwinFaces } from "./rewrite";

/** Repeated copies of the whole mesh. Copies that touch are welded and the faces between them removed. */
const DEFAULT_MERGE = 1e-4;

/** add a copy of `base` per transform, then fuse touching copies */
function addCopies(m: Mesh, count: number, place: (p: Vec3, c: number) => Vec3, mergeDist: number): void {
  const base = cloneMesh(m);
  for (let c = 1; c < count; c++) {
    append(m, { v: base.v.map((p) => place(p, c)), f: base.f, fm: base.fm });
  }
  weld(m, mergeDist);
  dropTwinFaces(m);
  invalidateTopology(m);
}

/** `count` copies in a row, each `offset` metres from the last */
export function arrayLinear(
  m: Mesh,
  count: number,
  offset: Vec3,
  size: Vec3,
  mergeDist = DEFAULT_MERGE,
): ElementSelection {
  const step = div3(offset, safeSize(size));
  addCopies(m, Math.max(1, Math.round(count)), (p, c) => add(p, scale(step, c)), mergeDist);
  return emptySelection();
}

export interface RadialArray {
  count: number;
  /** in metres, in the object's space */
  axis: Axis;
  /** the total sweep; 360 spaces the copies evenly around a full turn */
  angleDeg: number;
}

/** copies turned around an axis; a full turn spaces them evenly, a partial sweep puts the last copy at its end */
export function arrayRadial(m: Mesh, radial: RadialArray, size: Vec3, mergeDist = DEFAULT_MERGE): ElementSelection {
  const s = safeSize(size);
  const count = Math.max(1, Math.round(radial.count));
  const gaps = isFullTurn(radial.angleDeg) ? count : Math.max(1, count - 1);
  const step = degToRad(radial.angleDeg) / gaps;
  addCopies(m, count, (p, c) => div3(rotateAbout(mul3(p, s), radial.axis, step * c), s), mergeDist);
  return emptySelection();
}
