/**
 * The sky trail, east of the middle: a start pad on the ground, ten stepping stones winding up round a stone
 * column, and the finish on its top. Each step is a short jump up; one stone drifts up and down.
 */
import type { Mesh } from "@/lib/mesh/mesh";
import type { Vec3 } from "@/lib/vec";
import drifting from "./scripts/drifting-stone.lua";
import finish from "./scripts/trail-finish.lua";
import start from "./scripts/trail-start.lua";
import type { Mat } from "./palette";
import { STONE } from "./palette";
import { PLAZA_TOP } from "./ground";
import type { SceneBuilder } from "./place";
import { disc, lathe } from "./shapes";

/** the column the trail winds round */
export const TRAIL_CENTRE: Vec3 = [10, 1, 0];
const RADIUS = 3;
const STONES = 10;
/** how much higher each stone is than the one before */
const RISE = 0.45;
const STONE_R = 0.6;
const STONE_H = 0.25;
/** the top of the column: where the finish is */
export const SUMMIT_TOP = PLAZA_TOP + RISE * (STONES + 1);
const DRIFTING = 6;

const PAD: Mat = { name: "Start pad", color: "#45c46b", roughness: 0.5, emissive: 0.3 };
const GOAL: Mat = { name: "Finish pad", color: "#f2c94c", roughness: 0.4, emissive: 0.4 };
const SKY_STONE: Mat = { name: "Sky stone", color: "#c9c2d8", roughness: 0.7 };

const around = (angleDeg: number, r: number): Vec3 => {
  const a = (angleDeg * Math.PI) / 180;
  return [TRAIL_CENTRE[0] + Math.cos(a) * r, TRAIL_CENTRE[1] + Math.sin(a) * r, 0];
};

const column = (): Mesh =>
  lathe(
    [
      [0, 0],
      [1.7, 0],
      [1.45, 0.3],
      [1.3, SUMMIT_TOP - 0.1],
      [1.6, SUMMIT_TOP],
      [0, SUMMIT_TOP],
    ],
    32,
  );

export function addTrail(b: SceneBuilder): void {
  const [sx, sy] = around(-90, RADIUS);
  b.place(disc(0.9, 0.08), [sx, sy, PLAZA_TOP], [PAD], "Start pad").script = start;
  for (let i = 1; i <= STONES; i++) {
    const [x, y] = around(-90 + i * 36, RADIUS);
    const o = b.place(disc(STONE_R, STONE_H), [x, y, PLAZA_TOP + i * RISE - STONE_H], [SKY_STONE], "Stone " + i);
    if (i === DRIFTING) o.script = drifting;
  }
  b.place(column(), [TRAIL_CENTRE[0], TRAIL_CENTRE[1], 0], [STONE], "Sky column");
  b.place(disc(0.8, 0.06), [TRAIL_CENTRE[0], TRAIL_CENTRE[1], SUMMIT_TOP], [GOAL], "Finish").script = finish;
}
