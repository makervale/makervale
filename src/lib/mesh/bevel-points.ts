import type { Vec3 } from "../vec";
import { add, cross, dot, length, mul3, normalize, scale, sub } from "../vec";
import type { Mesh } from "./mesh";
import { faceNormal } from "./mesh";

/** a new point never reaches past this share of an edge, so points from both ends cannot cross */
const MAX_EDGE_SHARE = 0.45;

/**
 * The bevel's point set, in scaled (metre) space: the mesh's vertices, then the new points.
 * Every new point remembers the beveled vertex it replaces (its owner); old vertices own nothing (-1).
 */
export class BevelPoints {
  readonly pos: Vec3[];
  readonly owner: number[];
  private readonly pulled = new Map<string, number>();
  /** the original faces over the scaled positions, for true normals */
  private readonly scaledMesh: Mesh;

  constructor(
    m: Mesh,
    readonly size: Vec3,
    private readonly width: number,
  ) {
    this.pos = m.v.map((p) => mul3(p, size));
    this.owner = m.v.map(() => -1);
    this.scaledMesh = { v: this.pos, f: m.f, fm: m.fm };
  }

  add(p: Vec3, owner: number): number {
    this.pos.push(p);
    this.owner.push(owner);
    return this.pos.length - 1;
  }

  /** on the unbeveled edge v→x, `width` away from v (shared by both faces of that edge) */
  along(v: number, x: number): number {
    const key = `${v}>${x}`;
    const known = this.pulled.get(key);
    if (known !== undefined) return known;
    const d = sub(this.pos[x], this.pos[v]);
    const len = length(d);
    const t = len > 0 ? Math.min(this.width, MAX_EDGE_SHARE * len) / len : 0;
    const i = this.add(add(this.pos[v], scale(d, t)), v);
    this.pulled.set(key, i);
    return i;
  }

  /** inside face `fi`, `width` away from both beveled edges meeting at v (prev→v→next) */
  inside(v: number, prev: number, next: number, fi: number): number {
    const p = this.pos[v];
    const a = sub(this.pos[prev], p);
    const b = sub(this.pos[next], p);
    const d1 = normalize(a);
    const d2 = normalize(b);
    // inward perpendicular of the edge v→next (faces are counter-clockwise)
    const inward = cross(faceNormal(this.scaledMesh, this.scaledMesh.f[fi]), d2);
    let bisector = add(d1, d2);
    // a straight corner has no bisector; a reflex one points outward
    if (length(bisector) < 1e-6) bisector = inward;
    else bisector = scale(normalize(bisector), dot(normalize(bisector), inward) < 0 ? -1 : 1);
    let dist = this.width / Math.max(dot(bisector, inward), 1e-3);
    // a sharp corner must not overshoot the shorter edge
    const alongEdge = Math.abs(dot(bisector, d2));
    const limit = MAX_EDGE_SHARE * Math.min(length(a), length(b));
    if (dist * alongEdge > limit) dist = limit / alongEdge;
    return this.add(add(p, scale(bisector, dist)), v);
  }
}
