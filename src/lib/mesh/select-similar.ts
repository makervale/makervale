import type { Vec3 } from "../vec";
import { cross, dot, length, mul3, sub } from "../vec";
import type { Mesh } from "./mesh";
import { edgeKey } from "./mesh";
import { safeSize, scaledNormal } from "./scaled";
import { topologyOf } from "./topology";

/** Selections by shape: angles are measured in metres (the object's size), so they are true angles. */
const degToCos = (deg: number): number => Math.cos((deg * Math.PI) / 180);

/** edges whose two faces meet at more than `angleDeg` */
export function sharpEdges(m: Mesh, angleDeg: number, size: Vec3): Set<string> {
  const s = safeSize(size);
  const normals = m.f.map((face) => scaledNormal(m, face, s));
  const limit = degToCos(angleDeg);
  const out = new Set<string>();
  for (const [k, e] of topologyOf(m).edges) {
    if (e.faces.length === 2 && dot(normals[e.faces[0]], normals[e.faces[1]]) < limit) out.add(k);
  }
  return out;
}

/** faces sharing an edge with face `fi` (and `fi` itself) */
function edgeNeighbours(m: Mesh, fi: number): number[] {
  const t = topologyOf(m);
  const face = m.f[fi];
  return face.flatMap((a, k) => t.edges.get(edgeKey(a, face[(k + 1) % face.length]))!.faces);
}

/** faces reachable from each seed without turning more than `angleDeg` away from the seed's normal */
export function flatRegion(m: Mesh, seeds: Iterable<number>, angleDeg: number, size: Vec3): Set<number> {
  const s = safeSize(size);
  const limit = degToCos(angleDeg);
  const out = new Set<number>();
  const visit = (seed: number): void => {
    const n0 = scaledNormal(m, m.f[seed], s);
    const stack = [seed];
    out.add(seed);
    while (stack.length) {
      for (const g of edgeNeighbours(m, stack.pop()!)) {
        if (out.has(g) || dot(scaledNormal(m, m.f[g], s), n0) < limit) continue;
        out.add(g);
        stack.push(g);
      }
    }
  };
  for (const seed of seeds) if (!out.has(seed)) visit(seed);
  return out;
}

export type SimilarBy = "normal" | "area" | "material";

function scaledArea(m: Mesh, face: number[], size: Vec3): number {
  const p = face.map((i) => mul3(m.v[i], size));
  let area = 0;
  for (let i = 1; i < p.length - 1; i++) area += length(cross(sub(p[i], p[0]), sub(p[i + 1], p[0]))) / 2;
  return area;
}

interface FaceRef {
  n: Vec3;
  area: number;
  slot: number;
}

/** faces like the seeds: same slot, normal within `tol` degrees, or area within `tol` (relative) */
export function similarFaces(m: Mesh, seeds: Set<number>, by: SimilarBy, tol: number, size: Vec3): Set<number> {
  const s = safeSize(size);
  const refs: FaceRef[] = [...seeds].map((f) => ({
    n: scaledNormal(m, m.f[f], s),
    area: scaledArea(m, m.f[f], s),
    slot: m.fm[f],
  }));
  const limit = degToCos(tol);
  const matches = (face: number[], fi: number): boolean => {
    if (by === "material") return refs.some((r) => r.slot === m.fm[fi]);
    if (by === "normal") {
      const n = scaledNormal(m, face, s);
      return refs.some((r) => dot(r.n, n) >= limit);
    }
    const area = scaledArea(m, face, s);
    return refs.some((r) => Math.abs(area - r.area) <= tol * Math.max(r.area, 1e-9));
  };
  const out = new Set<number>(seeds);
  m.f.forEach((face, fi) => {
    if (!out.has(fi) && matches(face, fi)) out.add(fi);
  });
  return out;
}
