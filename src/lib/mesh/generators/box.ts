import type { Vec3 } from "../../vec";
import type { Mesh } from "../mesh";
import { pointKey } from "../mesh";

/** Starter meshes fit the unit cube [-0.5, 0.5]³ and are closed, except the plane. */
type Side = (i: number, j: number) => Vec3;

/** six parametrised faces of the unit cube, each wound to face outward */
function cubeSides(n: number): Side[] {
  return [
    (i, j) => [-0.5 + i / n, -0.5, -0.5 + j / n],
    (i, j) => [0.5 - i / n, 0.5, -0.5 + j / n],
    (i, j) => [-0.5, 0.5 - i / n, -0.5 + j / n],
    (i, j) => [0.5, -0.5 + i / n, -0.5 + j / n],
    (i, j) => [-0.5 + i / n, -0.5 + j / n, 0.5],
    (i, j) => [-0.5 + j / n, -0.5 + i / n, -0.5],
  ];
}

export function genBox(seg = 1): Mesh {
  const n = Math.max(1, seg | 0);
  const m: Mesh = { v: [], f: [], fm: [] };
  const byKey = new Map<string, number>();
  const vertex = (p: Vec3): number => {
    const key = pointKey(p);
    let i = byKey.get(key);
    if (i === undefined) {
      i = m.v.length;
      byKey.set(key, i);
      m.v.push(p);
    }
    return i;
  };
  for (const side of cubeSides(n)) {
    for (let i = 0; i < n; i++) {
      for (let j = 0; j < n; j++) {
        m.f.push([vertex(side(i, j)), vertex(side(i + 1, j)), vertex(side(i + 1, j + 1)), vertex(side(i, j + 1))]);
        m.fm.push(0);
      }
    }
  }
  return m;
}

export function genPlane(seg = 1): Mesh {
  const n = Math.max(1, seg | 0);
  const m: Mesh = { v: [], f: [], fm: [] };
  for (let j = 0; j <= n; j++) for (let i = 0; i <= n; i++) m.v.push([-0.5 + i / n, -0.5 + j / n, 0]);
  for (let j = 0; j < n; j++) {
    for (let i = 0; i < n; i++) {
      const a = j * (n + 1) + i;
      m.f.push([a, a + 1, a + n + 2, a + n + 1]);
      m.fm.push(0);
    }
  }
  return m;
}
