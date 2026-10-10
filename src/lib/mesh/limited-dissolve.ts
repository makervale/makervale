import type { Vec3 } from "../vec";
import { dot, sub } from "../vec";
import { boundsOf, diagonalOf } from "./bounds";
import { removeCollinear } from "./collinear";
import type { Mesh } from "./mesh";
import { edgeKey, faceNormal } from "./mesh";
import { mergeAcross } from "./merge-polygons";
import { dropOrphans } from "./ops/rewrite";
import { invalidateTopology } from "./topology";

/** slivers whose own normal is unreliable are judged by distance: this share of the mesh's diagonal */
const SLIVER_TOLERANCE = 1e-6;

/** the working state: faces merge into each other, merged-away ones become null */
class Dissolver {
  readonly faces: (number[] | null)[];
  private readonly normals: Vec3[];
  private readonly edgeUses = new Map<string, number>();
  /** directed edge "a>b" → the face running it */
  private readonly owner = new Map<string, number>();
  private readonly distTol: number;

  constructor(
    private readonly m: Mesh,
    private readonly minCos: number,
  ) {
    this.faces = m.f.map((face) => face.slice());
    this.normals = this.faces.map((face) => faceNormal(m, face!));
    this.distTol = diagonalOf(boundsOf(m.v)) * SLIVER_TOLERANCE;
    for (const face of m.f) {
      face.forEach((a, k) => {
        const key = edgeKey(a, face[(k + 1) % face.length]);
        this.edgeUses.set(key, (this.edgeUses.get(key) ?? 0) + 1);
      });
    }
    this.faces.forEach((_, i) => this.own(i, true));
  }

  private own(fi: number, on: boolean): void {
    const face = this.faces[fi]!;
    face.forEach((a, k) => {
      const key = `${a}>${face[(k + 1) % face.length]}`;
      if (on) this.owner.set(key, fi);
      else if (this.owner.get(key) === fi) this.owner.delete(key);
    });
  }

  private coplanar(fi: number, gi: number): boolean {
    if (this.m.fm[fi] !== this.m.fm[gi]) return false;
    const d = dot(this.normals[fi], this.normals[gi]);
    if (d >= this.minCos) return true;
    if (d <= 0) return false;
    // sliver test: every vertex of the smaller polygon lies on the other's plane
    const [big, small] = this.faces[fi]!.length >= this.faces[gi]!.length ? [fi, gi] : [gi, fi];
    const origin = this.m.v[this.faces[big]![0]];
    const n = this.normals[big];
    return this.faces[small]!.every((v) => Math.abs(dot(n, sub(this.m.v[v], origin))) <= this.distTol);
  }

  /** merge face fi with one coplanar neighbour; false when none qualifies */
  mergeOnce(fi: number): boolean {
    const face = this.faces[fi]!;
    for (let k = 0; k < face.length; k++) {
      const a = face[k];
      const b = face[(k + 1) % face.length];
      if (this.edgeUses.get(edgeKey(a, b)) !== 2) continue;
      const gi = this.owner.get(`${b}>${a}`);
      if (gi === undefined || gi === fi || !this.faces[gi] || !this.coplanar(fi, gi)) continue;
      const merged = mergeAcross(face, this.faces[gi]!, a, b);
      if (!merged) continue;
      // the merged normal is area-weighted, so on gently curved surfaces drift stays bounded by the angle test
      this.own(fi, false);
      this.own(gi, false);
      this.faces[gi] = null;
      this.faces[fi] = merged;
      this.normals[fi] = faceNormal(this.m, merged);
      this.own(fi, true);
      return true;
    }
    return false;
  }
}

/**
 * Merge adjacent coplanar faces (same slot, normals within `angleDeg`) into simple polygons, then remove
 * vertices sitting on a straight line between two others. Keeps closed meshes closed. Returns faces removed.
 */
export function limitedDissolve(m: Mesh, angleDeg = 1): number {
  const before = m.f.length;
  if (!before) return 0;
  const d = new Dissolver(m, Math.cos((angleDeg * Math.PI) / 180));
  for (let fi = before - 1; fi >= 0; fi--) while (d.faces[fi] && d.mergeOnce(fi));
  const slots = m.fm;
  m.f = [];
  m.fm = [];
  d.faces.forEach((face, i) => {
    if (!face) return;
    m.f.push(face);
    m.fm.push(slots[i]);
  });
  invalidateTopology(m);
  removeCollinear(m, angleDeg);
  dropOrphans(m);
  invalidateTopology(m);
  return before - m.f.length;
}
