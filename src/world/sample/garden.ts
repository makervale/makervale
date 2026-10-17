/** Round the games: trees beyond the rim, benches and lanterns on the plaza, and a trampoline to bounce on. */
import * as G from "@/lib/mesh/generators";
import { decimate } from "@/lib/mesh/decimate";
import type { Mesh } from "@/lib/mesh/mesh";
import type { Vec3 } from "@/lib/vec";
import lantern from "./scripts/lantern.lua";
import type { Mat } from "./palette";
import { BARK, IRON, LEAVES, LIGHT, WOOD } from "./palette";
import { PLAZA_R, PLAZA_TOP } from "./ground";
import type { SceneBuilder } from "./place";
import { box, disc, jitter, join, lathe, move, rotZ, scale } from "./shapes";

/** launch speed: about five metres up */
const TRAMPOLINE_M_S = 10;
const PADDING: Mat = { name: "Padding", color: "#2f78c9", roughness: 0.7 };
const MAT: Mat = { name: "Trampoline mat", color: "#202226", roughness: 0.9 };

const trunk = (h: number): Mesh =>
  lathe(
    [
      [0, 0],
      [0.3, 0],
      [0.18, 0.4],
      [0.12, h],
      [0, h],
    ],
    8,
  );

function crown(seed: number, size: Vec3): Mesh {
  const m = scale(G.genIcosphere(2), size);
  jitter(m, 0.14, seed);
  decimate(m, 0.45);
  return m;
}

function trampoline(): Mesh {
  const r = 1.05;
  const rim = move(scale(G.genTorus(40, 0.12), [r * 2 + 0.2, r * 2 + 0.2, 0.12]), [0, 0, 0.36]);
  const mat = move(disc(r, 0.03), [0, 0, 0.33]);
  const legs: [Mesh, number][] = [];
  for (let i = 0; i < 6; i++) {
    const a = (i / 6) * Math.PI * 2;
    legs.push([box([0.07, 0.07, 0.33], [Math.cos(a) * r, Math.sin(a) * r, 0]), 2]);
  }
  return join([rim, 0], [mat, 1], ...legs);
}

const bench = (): Mesh => join([box([1.8, 0.45, 0.08], [0, 0, 0.42]), 0], [box([0.08, 0.4, 0.42], [-0.75, 0, 0]), 1], [box([0.08, 0.4, 0.42], [0.75, 0, 0]), 1]);

const lampPost = (): Mesh =>
  lathe(
    [
      [0, 0],
      [0.16, 0],
      [0.06, 0.2],
      [0.045, 2.4],
      [0, 2.4],
    ],
    10,
  );

/** an iron cage round a glass that glows */
const lanternShape = (): Mesh => join([box([0.34, 0.34, 0.06], [0, 0, 0]), 0], [box([0.26, 0.26, 0.36], [0, 0, 0.06]), 1], [box([0.36, 0.36, 0.06], [0, 0, 0.42]), 0]);

export function addGarden(b: SceneBuilder): void {
  for (let i = 0; i < 12; i++) {
    // round the rim, leaving the way in (south) and the path north open
    const deg = 15 + i * 28 + (i > 5 ? 22 : 0);
    const a = (deg * Math.PI) / 180;
    const [x, y] = [Math.cos(a) * (PLAZA_R + 3), Math.sin(a) * (PLAZA_R + 3)];
    const h = 2.2 + (i % 3) * 0.5;
    const g = b.group();
    b.place(trunk(h), [x, y, 0], [BARK], "Trunk", g);
    b.place(crown(i + 1, [3.4, 3.4, 3.8]), [x, y, h + 1.2], [{ name: "Leaves", color: LEAVES[i % LEAVES.length], roughness: 0.9 }], "Crown", g);
  }
  for (const [x, y, deg] of [
    [-3.2, -3, 0],
    [3.2, -3, 0],
    [-3.2, 3, 180],
    [3.2, 3, 180],
  ]) {
    b.place(rotZ(bench(), deg), [x, y, PLAZA_TOP], [WOOD, IRON], "Bench");
  }
  for (const [x, y] of [
    [-6.5, -6.5],
    [6.5, -6.5],
    [-6.5, 7.5],
    [6.5, 7.5],
  ]) {
    const g = b.group();
    b.place(lampPost(), [x, y, PLAZA_TOP], [IRON], "Lamp post", g);
    b.place(lanternShape(), [x, y, PLAZA_TOP + 2.4], [IRON, LIGHT], "Lantern", g).script = lantern;
  }
  b.place(trampoline(), [4.5, 11, PLAZA_TOP], [PADDING, MAT, IRON], "Trampoline").spring = TRAMPOLINE_M_S;
}
