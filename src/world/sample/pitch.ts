/**
 * The football pitch, north of the plaza: mown stripes and white lines, low boards the ball bounces off (people
 * step over them), two goals that count, a football, and a scoreboard at the side that keeps the score.
 */
import * as G from "@/lib/mesh/generators";
import type { Mesh } from "@/lib/mesh/mesh";
import { faceCenter } from "@/lib/mesh/mesh";
import type { Vec3 } from "@/lib/vec";
import ballScript from "./scripts/ball.lua";
import goalScript from "./scripts/goal.lua";
import scoreboard from "./scripts/scoreboard.lua";
import type { Mat } from "./palette";
import { IRON, WOOD } from "./palette";
import { GOAL_HALF_W, addGoal } from "./goal";
import type { SceneBuilder } from "./place";
import { box, join, scale } from "./shapes";

const CENTRE: Vec3 = [0, 31, 0];
const HALF_W = 7;
const HALF_L = 11;
const LINE = 0.1;
/** twice a real football, so it reads well from a distance */
const BALL_R = 0.22;
const TURF_TOP = 0.02;

const TURF: Mat = { name: "Turf", color: "#5fa04a", roughness: 0.95 };
const TURF_DARK: Mat = { name: "Turf (mown)", color: "#548f41", roughness: 0.95 };
const CHALK: Mat = { name: "Chalk", color: "#f4f4ee", roughness: 0.8 };
const RED_NET: Mat = { name: "Red net", color: "#f2a19a", roughness: 0.8, opacity: 0.85 };
const BLUE_NET: Mat = { name: "Blue net", color: "#a3bdf2", roughness: 0.8, opacity: 0.85 };
const LEATHER: Mat = { name: "Ball leather", color: "#f4f2ec", roughness: 0.45 };
const PATCHES: Mat = { name: "Ball patches", color: "#22252b", roughness: 0.45 };
const BOARD: Mat = { name: "Scoreboard", color: "#20262f", roughness: 0.6 };

const at = (x: number, y: number, z = 0): Vec3 => [CENTRE[0] + x, CENTRE[1] + y, CENTRE[2] + z];

/** stripes across, then the touch lines, goal lines, halfway line and the centre spot */
function turf(): Mesh {
  const parts: [Mesh, number][] = [];
  const n = 11;
  const w = (HALF_L * 2) / n;
  for (let i = 0; i < n; i++) parts.push([box([HALF_W * 2, w, TURF_TOP], [0, -HALF_L + w * (i + 0.5), 0]), i % 2]);
  const z = TURF_TOP;
  for (const x of [-HALF_W, HALF_W]) parts.push([box([LINE, HALF_L * 2, 0.005], [x, 0, z]), 2]);
  for (const y of [-HALF_L, 0, HALF_L]) parts.push([box([HALF_W * 2, LINE, 0.005], [0, y, z]), 2]);
  parts.push([box([0.4, 0.4, 0.005], [0, 0, z]), 2]);
  return join(...parts);
}

/** low boards round the pitch, open behind the goals */
function boards(): Mesh {
  const h = 0.45;
  const t = 0.08;
  const side = HALF_L + 0.6;
  const end = (HALF_W - GOAL_HALF_W) / 2 + 0.3;
  const parts: [Mesh, number][] = [];
  for (const x of [-HALF_W - 0.6, HALF_W + 0.6]) parts.push([box([t, side * 2, h], [x, 0, 0]), 0]);
  for (const y of [-side, side]) {
    for (const s of [-1, 1]) parts.push([box([end * 2, t, h], [s * (HALF_W + 0.6 - end), y, 0]), 0]);
  }
  return join(...parts);
}

/** a football: a fine icosphere, white, with the faces round each of its twelve corners dark */
function ball(): Mesh {
  const m = G.genIcosphere(3);
  const corners = G.genIcosphere(0).v;
  m.fm = m.f.map((face) => {
    const c = faceCenter(m, face);
    const l = Math.hypot(c[0], c[1], c[2]) || 1;
    return corners.some((k) => (k[0] * c[0] + k[1] * c[1] + k[2] * c[2]) / (l * Math.hypot(...k)) > 0.945) ? 1 : 0;
  });
  return scale(m, [BALL_R * 2, BALL_R * 2, BALL_R * 2]);
}

/** a dark board on two legs, facing the pitch */
function board(): Mesh {
  return join([box([0.16, 3.2, 1.5], [0, 0, 1.2]), 0], [box([0.12, 0.12, 1.2], [0, -1.2, 0]), 1], [box([0.12, 0.12, 1.2], [0, 1.2, 0]), 1]);
}

export function addPitch(b: SceneBuilder): void {
  b.place(turf(), at(0, 0), [TURF, TURF_DARK, CHALK], "Pitch");
  b.place(boards(), at(0, 0), [WOOD], "Pitch boards");
  addGoal(b, at(0, HALF_L), 1, goalScript, RED_NET);
  addGoal(b, at(0, -HALF_L), -1, goalScript, BLUE_NET);
  const o = b.place(ball(), at(0, 0, TURF_TOP + BALL_R), [LEATHER, PATCHES], "Ball");
  o.body = { shape: "ball", bounce: 0.6 };
  o.script = ballScript;
  b.place(board(), at(-HALF_W - 2.2, 0), [BOARD, IRON], "Scoreboard").script = scoreboard;
}
