/** The plaza and the domed rotunda on its dais: spun columns in a radial array, a spun ring beam, a solidified dome. */
import { bevel } from "@/lib/mesh/bevel";
import * as G from "@/lib/mesh/generators";
import type { Mesh } from "@/lib/mesh/mesh";
import { arrayRadial } from "@/lib/mesh/ops/array";
import { deleteFaces } from "@/lib/mesh/ops/delete";
import { inset } from "@/lib/mesh/ops/inset";
import { solidify } from "@/lib/mesh/ops/solidify";
import { topologyOf } from "@/lib/mesh/topology";
import { cylinderUV } from "@/lib/mesh/uv";
import { addCrystal } from "./crystal";
import { COPPER, GOLD, MARBLE, STONE, TILES } from "./palette";
import type { SceneBuilder } from "./place";
import { ONE, bevelSharp, box, facesWhere, lathe, move, revolve, rotZ, scale, topFace } from "./shapes";

/** bevelled slab whose top is inset into a stone border and a tiled field */
function plaza(): Mesh {
  const m = box([16, 16, 0.3]);
  const top = topFace(m);
  const rim = [...topologyOf(m).edges].filter(([, e]) => m.v[e.a][2] > 0.29 && m.v[e.b][2] > 0.29).map(([k]) => k);
  bevel(m, new Set(rim), 0.08, 2, ONE);
  inset(m, new Set([top]), 0.07, -0.02);
  m.fm[top] = 1;
  return m;
}

const dais = (): Mesh =>
  lathe(
    [
      [0, 0],
      [4.2, 0],
      [4.2, 0.48],
      [4.1, 0.6],
      [0, 0.6],
    ],
    48,
  );

function stairs(): Mesh {
  const m = G.genStairs(3);
  scale(m, [1.2, 2.6, 0.6]);
  move(m, [0, 0, 0.3]);
  return rotZ(m, 90);
}

const column = (): Mesh =>
  lathe(
    [
      [0, 0],
      [0.34, 0],
      [0.34, 0.14],
      [0.3, 0.18],
      [0.27, 0.24],
      [0.24, 0.3],
      [0.21, 0.36],
      [0.19, 2.55],
      [0.22, 2.62],
      [0.27, 2.7],
      [0.32, 2.76],
      [0.32, 2.88],
      [0, 2.88],
    ],
    16,
  );

function colonnade(): Mesh {
  const m = move(column(), [3.3, 0, 0]);
  arrayRadial(m, { count: 8, axis: { p: [0, 0, 0], d: [0, 0, 1] }, angleDeg: 360 }, ONE);
  return m;
}

/** a profile away from the axis: spin makes a closed ring */
const ringBeam = (): Mesh =>
  revolve(
    [
      [2.85, 0],
      [3.7, 0],
      [3.7, 0.3],
      [3.85, 0.36],
      [3.85, 0.46],
      [2.85, 0.46],
    ].map(([r, z]) => [r, 0, z]),
    [0, 0, 1],
    360,
    48,
  );

/** half a sphere given a wall with Solidify; UV wrapped around it so the copper plates run in rings */
function dome(): Mesh {
  const m = scale(G.genSphere(32), [7, 7, 7]);
  deleteFaces(
    m,
    facesWhere(m, (_n, c) => c[2] < -1e-3),
  );
  solidify(m, 0.14, ONE);
  cylinderUV(m, ONE);
  return m;
}

const finial = (): Mesh =>
  lathe(
    [
      [0, 0],
      [0.24, 0],
      [0.13, 0.16],
      [0.2, 0.36],
      [0.06, 0.56],
      [0.045, 0.92],
      [0, 1.05],
    ],
    12,
  );

export function pedestal(): Mesh {
  return bevelSharp(box([0.9, 0.9, 1.0]), 0.05, 2);
}

export function addPlaza(b: SceneBuilder): void {
  b.place(plaza(), [0, 0, 0], [STONE, TILES], "Plaza");
}

export function addRotunda(b: SceneBuilder): void {
  const g = b.group();
  b.place(dais(), [0, 2.5, 0.3], [STONE], "Dais", g);
  b.place(stairs(), [0, -2.15, 0.3], [STONE], "Steps", g);
  b.place(colonnade(), [0, 2.5, 0.9], [MARBLE], "Colonnade", g);
  b.place(ringBeam(), [0, 2.5, 3.78], [MARBLE], "Ring beam", g);
  b.place(dome(), [0, 2.5, 4.24], [COPPER], "Dome", g);
  b.place(finial(), [0, 2.5, 7.62], [GOLD], "Finial", g).script = "on start { spin 0, 0, 20 }\n";
  b.place(pedestal(), [0, 2.5, 0.9], [MARBLE], "Pedestal", g);
  addCrystal(b, g);
}
