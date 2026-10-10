import type { Vec3 } from "../../vec";
import { normalize, scale } from "../../vec";
import type { Mesh } from "../mesh";

const PHI = (1 + Math.sqrt(5)) / 2;
const MAX_LEVEL = 5;

const ICOSAHEDRON_VERTS: Vec3[] = [
  [-1, PHI, 0],
  [1, PHI, 0],
  [-1, -PHI, 0],
  [1, -PHI, 0],
  [0, -1, PHI],
  [0, 1, PHI],
  [0, -1, -PHI],
  [0, 1, -PHI],
  [PHI, 0, -1],
  [PHI, 0, 1],
  [-PHI, 0, -1],
  [-PHI, 0, 1],
];
const ICOSAHEDRON_FACES: number[][] = [
  [0, 11, 5],
  [0, 5, 1],
  [0, 1, 7],
  [0, 7, 10],
  [0, 10, 11],
  [1, 5, 9],
  [5, 11, 4],
  [11, 10, 2],
  [10, 7, 6],
  [7, 1, 8],
  [3, 9, 4],
  [3, 4, 2],
  [3, 2, 6],
  [3, 6, 8],
  [3, 8, 9],
  [4, 9, 5],
  [2, 4, 11],
  [6, 2, 10],
  [8, 6, 7],
  [9, 8, 1],
];

/** projected onto the sphere of radius 0.5 */
const onSphere = (p: Vec3): Vec3 => scale(normalize(p), 0.5);

/** split every triangle into four, with the new midpoints pushed onto the sphere */
function subdivideOnce(v: Vec3[], f: number[][]): number[][] {
  const mid = new Map<string, number>();
  const midpoint = (a: number, b: number): number => {
    const key = a < b ? `${a}_${b}` : `${b}_${a}`;
    let i = mid.get(key);
    if (i === undefined) {
      i = v.length;
      v.push(onSphere([v[a][0] + v[b][0], v[a][1] + v[b][1], v[a][2] + v[b][2]]));
      mid.set(key, i);
    }
    return i;
  };
  const out: number[][] = [];
  for (const [a, b, c] of f) {
    const ab = midpoint(a, b);
    const bc = midpoint(b, c);
    const ca = midpoint(c, a);
    out.push([a, ab, ca], [b, bc, ab], [c, ca, bc], [ab, bc, ca]);
  }
  return out;
}

export function genIcosphere(level = 2): Mesh {
  const v = ICOSAHEDRON_VERTS.map(onSphere);
  let f = ICOSAHEDRON_FACES.map((t) => t.slice());
  const steps = Math.min(MAX_LEVEL, Math.max(0, level | 0));
  for (let s = 0; s < steps; s++) f = subdivideOnce(v, f);
  return { v, f, fm: f.map(() => 0) };
}
