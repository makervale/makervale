import { distance } from "../../vec";
import type { Mesh } from "../mesh";
import { centroid } from "../points";
import type { ElementSelection } from "../selection";
import { emptySelection } from "../selection";
import { vertsSelection } from "../selection-of";
import { invalidateTopology } from "../topology";
import { dropOrphans, remapFaces } from "./rewrite";

/** Collapse the selected vertices into one at their centre. */
export function mergeAtCenter(m: Mesh, verts: Set<number>): ElementSelection {
  const ids = [...verts];
  if (ids.length < 2) return emptySelection();
  const keep = ids[0];
  m.v[keep] = centroid(m, ids);
  remapFaces(m, (i) => (verts.has(i) ? keep : i));
  const map = dropOrphans(m);
  invalidateTopology(m);
  const kept = map.get(keep);
  return vertsSelection(kept === undefined ? [] : [kept]);
}

/** union-find over vertex indices, always keeping the lower index as the root */
function unionFind(n: number): { find: (i: number) => number; union: (i: number, j: number) => void } {
  const parent = Array.from({ length: n }, (_, i) => i);
  const find = (i: number): number => (parent[i] === i ? i : (parent[i] = find(parent[i])));
  const union = (i: number, j: number): void => {
    const a = find(i);
    const b = find(j);
    if (a !== b) parent[Math.max(a, b)] = Math.min(a, b);
  };
  return { find, union };
}

/** the 27 grid cells around (and including) a cell */
export function neighbourCells(cx: number, cy: number, cz: number): string[] {
  const out: string[] = [];
  for (let x = -1; x <= 1; x++) {
    for (let y = -1; y <= 1; y++) {
      for (let z = -1; z <= 1; z++) out.push(`${cx + x},${cy + y},${cz + z}`);
    }
  }
  return out;
}

/** Merge vertices closer than `dist`. Returns how many were merged. */
export function weld(m: Mesh, dist: number): number {
  const d = Math.max(dist, 1e-9);
  const inv = 1 / d;
  const grid = new Map<string, number[]>();
  const sets = unionFind(m.v.length);
  m.v.forEach((p, i) => {
    const cx = Math.floor(p[0] * inv);
    const cy = Math.floor(p[1] * inv);
    const cz = Math.floor(p[2] * inv);
    for (const key of neighbourCells(cx, cy, cz)) {
      for (const j of grid.get(key) ?? []) if (distance(p, m.v[j]) <= d) sets.union(i, j);
    }
    const key = `${cx},${cy},${cz}`;
    const cell = grid.get(key);
    if (cell) cell.push(i);
    else grid.set(key, [i]);
  });
  let merged = 0;
  m.v.forEach((_, i) => {
    if (sets.find(i) !== i) merged++;
  });
  if (!merged) return 0;
  remapFaces(m, sets.find);
  dropOrphans(m);
  invalidateTopology(m);
  return merged;
}
