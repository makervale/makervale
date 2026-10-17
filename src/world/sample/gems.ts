/**
 * The gem hunt: a treasure chest by the way in, and five glowing gems hidden round the plaza, one of them on top of
 * the sky trail. The chest counts what each person finds, and opens its lid for whoever finds all five.
 */
import * as G from "@/lib/mesh/generators";
import type { Mesh } from "@/lib/mesh/mesh";
import type { Vec3 } from "@/lib/vec";
import chest from "./scripts/chest.lua";
import gem from "./scripts/gem.lua";
import lid from "./scripts/lid.lua";
import type { Mat } from "./palette";
import { GOLD, WOOD } from "./palette";
import { PLAZA_TOP } from "./ground";
import type { SceneBuilder } from "./place";
import { SUMMIT_TOP, TRAIL_CENTRE } from "./trail";
import { box, join, move, scale } from "./shapes";

const CHEST_AT: Vec3 = [-3, -10, PLAZA_TOP];
const GEM_COLORS = ["#ff5a7a", "#5ad1ff", "#7dff6a", "#ffd34d", "#c77dff"];

/** where the gems hide: on the summit, behind the hall of fame, by Simon's bells, by the pitch, behind a tree */
const GEM_SPOTS: Vec3[] = [
  [TRAIL_CENTRE[0] + 0.9, TRAIL_CENTRE[1] + 0.6, SUMMIT_TOP],
  [0.6, 0.75, PLAZA_TOP],
  [-14, 5.5, PLAZA_TOP],
  [8.6, 21, 0],
  [13.2, -11.6, PLAZA_TOP],
];

/** a box with a darker band and gold corners on the front */
function chestBody(): Mesh {
  return join([box([1.2, 0.75, 0.55], [0, 0, 0]), 0], [box([1.24, 0.79, 0.08], [0, 0, 0.42]), 1]);
}

const chestLid = (): Mesh => box([1.24, 0.79, 0.2], [0, 0, 0]);

/** a cut gem: a squashed, two-tipped cone */
function gemShape(): Mesh {
  const m = scale(G.genIcosphere(1), [0.36, 0.36, 0.46]);
  return move(m, [0, 0, 0.35]);
}

export function addGems(b: SceneBuilder): void {
  const g = b.group();
  b.place(chestBody(), CHEST_AT, [WOOD, GOLD], "Treasure chest", g).script = chest;
  b.place(chestLid(), [CHEST_AT[0], CHEST_AT[1], CHEST_AT[2] + 0.55], [WOOD], "Chest lid", g).script = lid;
  GEM_SPOTS.forEach((at, i) => {
    const mat: Mat = { name: "Gem", color: GEM_COLORS[i], roughness: 0.1, metalness: 0.2, emissive: 0.6, opacity: 0.9 };
    b.place(gemShape(), at, [mat], "Gem " + (i + 1)).script = gem;
  });
}
