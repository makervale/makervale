import type { Mesh } from "../mesh";
import { orientOutward } from "../ops/normals";

/** side profile in the XZ plane: a staircase rising toward +x, then extruded along Y */
function profile(n: number): [number, number][] {
  const points: [number, number][] = [
    [-0.5, -0.5],
    [0.5, -0.5],
  ];
  for (let k = n; k >= 1; k--) {
    const z = -0.5 + k / n;
    const x = -0.5 + k / n;
    points.push([x, z], [x - 1 / n, z]);
  }
  return points;
}

export function genStairs(steps = 5): Mesh {
  const n = Math.max(1, steps | 0);
  const points = profile(n);
  const len = points.length;
  const m: Mesh = { v: [], f: [], fm: [] };
  for (const [x, z] of points) m.v.push([x, -0.5, z]);
  for (const [x, z] of points) m.v.push([x, 0.5, z]);
  for (let i = 0; i < len; i++) {
    const j = (i + 1) % len;
    m.f.push([i, len + i, len + j, j]);
    m.fm.push(0);
  }
  m.f.push(points.map((_, i) => i));
  m.f.push(points.map((_, i) => len + i).reverse());
  m.fm.push(0, 0);
  return orientOutward(m);
}
