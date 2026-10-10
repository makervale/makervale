import type { Mesh } from "../mesh";
import { invalidateTopology } from "../topology";
import { dropTwinFaces } from "./rewrite";

const ON_PLANE = 1e-4;

/** Add the mirrored half across X = 0; vertices on the plane are shared. */
export function mirrorX(m: Mesh): void {
  const map = new Map<number, number>();
  const originals = m.v.length;
  for (let i = 0; i < originals; i++) {
    const p = m.v[i];
    if (Math.abs(p[0]) < ON_PLANE) {
      p[0] = 0;
      map.set(i, i);
      continue;
    }
    map.set(i, m.v.length);
    m.v.push([-p[0], p[1], p[2]]);
  }
  const faces = m.f.length;
  for (let fi = 0; fi < faces; fi++) {
    const mirrored = m.f[fi].map((i) => map.get(i)!).reverse();
    if (new Set(mirrored).size < 3) continue;
    m.f.push(mirrored);
    m.fm.push(m.fm[fi]);
  }
  // faces lying on the mirror plane would now be doubled back-to-back: drop both copies
  dropTwinFaces(m);
  invalidateTopology(m);
}
