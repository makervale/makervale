import type { Vec3 } from "../../vec";
import type { Mesh } from "../mesh";
import { invalidateTopology } from "../topology";

/**
 * Low-level rewrites of the face list that other operations build on.
 * Each mutates in place; callers invalidate the topology when they are done.
 */

/** renumber every face corner; faces that collapse below three distinct corners disappear */
export function remapFaces(m: Mesh, remap: (i: number) => number): void {
  const f: number[][] = [];
  const fm: number[] = [];
  m.f.forEach((face, i) => {
    const q: number[] = [];
    for (const v of face) {
      const j = remap(v);
      if (!q.includes(j)) q.push(j);
    }
    if (q.length < 3) return;
    f.push(q);
    fm.push(m.fm[i]);
  });
  m.f = f;
  m.fm = fm;
}

/** remove vertices no face uses; returns old index → new index for the survivors */
export function dropOrphans(m: Mesh): Map<number, number> {
  const used = new Set<number>();
  for (const face of m.f) for (const i of face) used.add(i);
  const map = new Map<number, number>();
  const v: Vec3[] = [];
  m.v.forEach((p, i) => {
    if (!used.has(i)) return;
    map.set(i, v.length);
    v.push(p);
  });
  m.v = v;
  m.f = m.f.map((face) => face.map((i) => map.get(i)!));
  return map;
}

/** drop the faces at these indices (vertices stay) */
export function removeFaces(m: Mesh, drop: Set<number>): void {
  if (!drop.size) return;
  m.f = m.f.filter((_, i) => !drop.has(i));
  m.fm = m.fm.filter((_, i) => !drop.has(i));
}

const vertexSetKey = (face: number[]): string =>
  face
    .slice()
    .sort((a, b) => a - b)
    .join(",");

/** drop faces that sit back to back on the same vertices (left behind by welding copies together) */
export function dropTwinFaces(m: Mesh): number {
  const count = new Map<string, number>();
  for (const face of m.f) {
    const k = vertexSetKey(face);
    count.set(k, (count.get(k) ?? 0) + 1);
  }
  const drop = new Set<number>();
  m.f.forEach((face, i) => {
    if (count.get(vertexSetKey(face))! > 1) drop.add(i);
  });
  if (drop.size) {
    removeFaces(m, drop);
    dropOrphans(m);
    invalidateTopology(m);
  }
  return drop.size;
}
