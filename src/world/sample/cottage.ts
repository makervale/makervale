/** The cottage west of the plaza: Boolean walls, a merged-ridge roof, an inset chimney, the door and glass. */
import { IDENTITY } from "@/lib/mesh/affine";
import { booleanOp } from "@/lib/mesh/boolean";
import * as G from "@/lib/mesh/generators";
import type { Mesh } from "@/lib/mesh/mesh";
import { faceCenter, faceNormal } from "@/lib/mesh/mesh";
import { inset } from "@/lib/mesh/ops/inset";
import { mergeAtCenter } from "@/lib/mesh/ops/merge";
import { addDoor } from "./door";
import { BRICK, GLASS, IRON, ROOF, WOOD } from "./palette";
import type { SceneBuilder } from "./place";
import { bevelSharp, box, join, move, rotZ, scale, topFace } from "./shapes";

const COTTAGE_X = -12.6;
const COTTAGE_Y = 2.2;

const cut = (m: Mesh, hole: Mesh): Mesh =>
  booleanOp({ mesh: m, matrix: IDENTITY }, { mesh: hole, matrix: IDENTITY }, "subtract", 0);

/** a block hollowed out, then windows and a door cut through the walls */
function walls(): Mesh {
  let m = cut(box([4, 5.5, 2.7]), box([3.6, 5.1, 3.2], [0, 0, 0.15]));
  const front: [number, number, number][] = [
    [-1.55, 1.0, 1.0],
    [1.55, 1.0, 1.0],
    [0, 0.15, 2.0],
  ];
  for (const [cy, z0, h] of front) m = cut(m, box([0.8, 1.0, h], [2, cy, z0]));
  for (const sy of [-1, 1]) m = cut(m, box([1.1, 0.8, 1.0], [0, sy * 2.75, 1.0]));
  return m;
}

/** a block whose top corners are merged into a ridge */
function roof(): Mesh {
  const m = box([4.7, 6.1, 1.7]);
  for (const y of [-3.05, 3.05]) {
    const ends = m.v.map((_, i) => i).filter((i) => m.v[i][2] > 1.69 && Math.abs(m.v[i][1] - y) < 1e-6);
    mergeAtCenter(m, new Set(ends));
  }
  return m;
}

function chimney(): Mesh {
  const m = box([0.55, 0.55, 1.7]);
  inset(m, new Set([topFace(m)]), 0.28, -0.7);
  return m;
}

function panes(): Mesh {
  const front = [-1.55, 1.55].map((y): [Mesh, number] => [box([0.03, 0.96, 0.96], [1.95, y, 1.02]), 0]);
  const sides = [-1, 1].map((s): [Mesh, number] => [box([1.06, 0.03, 0.96], [0, s * 2.62, 1.02]), 0]);
  return join(...front, ...sides);
}

/** a ringed cylinder bulged out in the middle, two rings painted iron */
function barrel(): Mesh {
  const m = scale(G.genCylinder(20, 8), [0.8, 0.8, 1.05]);
  move(m, [0, 0, 0.525]);
  for (const v of m.v) {
    if (Math.hypot(v[0], v[1]) < 1e-6) continue;
    const k = 1 + 0.16 * Math.sin(Math.PI * (v[2] / 1.05));
    v[0] *= k;
    v[1] *= k;
  }
  const hoop = (z: number) => (z > 0.13 && z < 0.26) || (z > 0.79 && z < 0.92);
  m.f.forEach((p, i) => {
    if (Math.abs(faceNormal(m, p)[2]) < 0.5 && hoop(faceCenter(m, p)[2])) m.fm[i] = 1;
  });
  return m;
}

function crate(s: number): Mesh {
  const m = bevelSharp(box([s, s, s]), 0.02, 1);
  const sides = m.f
    .map((_, i) => i)
    .filter((i) => m.f[i].length === 4 && faceNormal(m, m.f[i]).some((x) => Math.abs(x) > 0.99));
  inset(m, new Set(sides), 0.14, -0.02);
  return m;
}

export function addCottage(b: SceneBuilder): void {
  const g = b.group();
  const [cx, cy] = [COTTAGE_X, COTTAGE_Y];
  b.place(walls(), [cx, cy, 0], [BRICK], "Cottage walls", g);
  b.place(roof(), [cx, cy, 2.7], [ROOF], "Roof", g);
  b.place(chimney(), [cx - 1, cy + 1.6, 3.1], [BRICK], "Chimney", g);
  addDoor(b, cx, cy, g);
  b.place(panes(), [cx, cy, 0], [GLASS], "Windows", g);
  b.place(barrel(), [-9.7, 5.6, 0], [{ ...WOOD, rot: 90 }, IRON], "Barrel");
  b.place(crate(0.75), [-9.8, -1.6, 0], [WOOD], "Crate");
  b.place(rotZ(crate(0.6), 20), [-9.75, -1.55, 0.75], [WOOD], "Crate");
}
