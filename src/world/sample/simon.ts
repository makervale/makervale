/** Simon, west of the middle: an orb on a pedestal and six coloured bells on posts in a half circle behind it. */
import * as G from "@/lib/mesh/generators";
import type { Mesh } from "@/lib/mesh/mesh";
import type { Vec3 } from "@/lib/vec";
import bell from "./scripts/bell.lua";
import simon from "./scripts/simon.lua";
import type { Mat } from "./palette";
import { IRON, MARBLE } from "./palette";
import { PLAZA_TOP } from "./ground";
import type { SceneBuilder } from "./place";
import { lathe, move, scale } from "./shapes";

export const SIMON_CENTRE: Vec3 = [-10, 1, 0];
const BELL_COLORS = ["#e04a3f", "#ee8a2f", "#f1c63a", "#4bb37a", "#3a8fe0", "#9b5fd6"];
const ORB: Mat = { name: "Orb", color: "#7fc8ff", roughness: 0.15, metalness: 0.1, emissive: 0.3 };
const POST_H = 1.15;

const pedestal = (): Mesh =>
  lathe(
    [
      [0, 0],
      [0.55, 0],
      [0.32, 0.25],
      [0.24, 0.85],
      [0.42, 1.0],
      [0, 1.0],
    ],
    24,
  );

const post = (): Mesh =>
  lathe(
    [
      [0, 0],
      [0.22, 0],
      [0.06, 0.12],
      [0.05, POST_H],
      [0, POST_H],
    ],
    12,
  );

/** a bell, mouth down */
const bellShape = (): Mesh =>
  lathe(
    [
      [0, 0],
      [0.34, 0],
      [0.3, 0.08],
      [0.2, 0.3],
      [0.16, 0.44],
      [0.05, 0.5],
      [0, 0.5],
    ],
    24,
  );

export function addSimon(b: SceneBuilder): void {
  const [cx, cy] = SIMON_CENTRE;
  b.place(pedestal(), [cx, cy, PLAZA_TOP], [MARBLE], "Simon pedestal");
  b.place(move(scale(G.genIcosphere(3), [0.9, 0.9, 0.9]), [0, 0, 0.45]), [cx, cy, PLAZA_TOP + 1], [ORB], "Simon").script =
    simon;
  BELL_COLORS.forEach((color, i) => {
    const a = ((110 + i * 28) * Math.PI) / 180;
    const [x, y] = [cx + Math.cos(a) * 3, cy + Math.sin(a) * 3];
    b.place(post(), [x, y, PLAZA_TOP], [IRON], "Bell post");
    const mat: Mat = { name: "Bell", color, roughness: 0.25, metalness: 0.5 };
    b.place(bellShape(), [x, y, PLAZA_TOP + POST_H], [mat], "Bell " + (i + 1)).script = bell;
  });
}
