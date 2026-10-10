/** Trees, pines, bushes and rocks: jittered icospheres, decimated, on spun trunks. */
import { decimate } from "@/lib/mesh/decimate";
import * as G from "@/lib/mesh/generators";
import type { Mesh } from "@/lib/mesh/mesh";
import type { Vec3 } from "@/lib/vec";
import { BARK, LEAVES, ROCK } from "./palette";
import type { SceneBuilder } from "./place";
import { jitter, lathe, scale } from "./shapes";

const trunk = (h: number): Mesh =>
  lathe(
    [
      [0, 0],
      [0.3, 0],
      [0.19, 0.3],
      [0.13, h],
      [0, h],
    ],
    8,
  );

export function crown(seed: number, s: Vec3): Mesh {
  const m = scale(G.genIcosphere(2), s);
  jitter(m, 0.14, seed);
  decimate(m, 0.45);
  return m;
}

const pine = (): Mesh =>
  lathe(
    [
      [0, 0],
      [1.35, 0],
      [0.62, 1.0],
      [1.05, 1.0],
      [0.42, 2.0],
      [0.78, 2.0],
      [0, 3.4],
    ],
    9,
  );

const rock = (seed: number, s: Vec3): Mesh => jitter(scale(G.genIcosphere(1), s), 0.22, seed);

/** x, y, seed */
const TREES: Vec3[] = [
  [11.2, 6.5, 1],
  [12.4, -2.4, 2],
  [10.6, -10.4, 3],
  [-11.6, -8.2, 4],
  [-4.8, 12.2, 5],
  [5.2, 12.6, 6],
];
const PINES: [number, number][] = [
  [-13.6, 9.6],
  [13.4, 1.8],
  [-2.6, -12.4],
];
/** x, y, seed, size */
const ROCKS: [number, number, number, Vec3][] = [
  [9.6, 3.2, 1, [1.4, 1.1, 0.8]],
  [12.8, -6.4, 2, [0.9, 0.8, 0.55]],
  [-9.4, 9.8, 3, [1.2, 1.0, 0.7]],
  [-11.8, -4.6, 4, [0.7, 0.6, 0.45]],
  [3.6, -11.2, 5, [1.0, 0.9, 0.6]],
];

export function addNature(b: SceneBuilder): void {
  for (const [x, y, s] of TREES) {
    const g = b.group();
    const h = 1.8 + (s % 3) * 0.3;
    b.place(trunk(h), [x, y, 0], [BARK], "Trunk", g);
    const leaves = { name: "Leaves", color: LEAVES[s % LEAVES.length], roughness: 0.85 };
    b.place(crown(s * 7, [3.2, 3.2, 3.6]), [x, y, h + 1.1], [leaves], "Crown", g);
  }
  for (const [x, y] of PINES) {
    b.place(pine(), [x, y, 0], [{ name: "Pine needles", color: "#3f6b3d", roughness: 0.9 }], "Pine");
  }
  for (const [x, y, s, size] of ROCKS) b.place(rock(s, size), [x, y, size[2] * 0.22], [ROCK], "Rock");
}
