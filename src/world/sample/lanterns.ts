/** Lamps on the plaza corners; each lantern can be switched off and on. */
import * as G from "@/lib/mesh/generators";
import type { Mesh } from "@/lib/mesh/mesh";
import { inset } from "@/lib/mesh/ops/inset";
import { IRON, LIGHT } from "./palette";
import type { SceneBuilder } from "./place";
import { box, facesWhere, join, lathe, move, rotZ, scale } from "./shapes";

const SCRIPT = `// Click to switch the lantern off and on (only its glass glows).
var lit = true
on touch {
  lit = not lit
  if lit { glow 1.4, 2; color "#ffd27a", 2 } else { glow 0, 2; color "#8f8a7c", 2 }
}
`;

const CORNERS: [number, number][] = [
  [-7.2, -7.2],
  [7.2, -7.2],
  [7.2, 7.2],
  [-7.2, 7.2],
];

const lampPost = (): Mesh =>
  lathe(
    [
      [0, 0],
      [0.17, 0],
      [0.17, 0.1],
      [0.09, 0.2],
      [0.06, 2.35],
      [0.1, 2.45],
      [0, 2.45],
    ],
    12,
  );

/** a box whose sides are inset into glowing panes, with a four-sided cap */
function lantern(): Mesh {
  const b = box([0.34, 0.34, 0.42]);
  const sides = facesWhere(b, (n) => Math.abs(n[2]) < 0.5);
  inset(b, sides, 0.2, -0.02);
  for (const f of sides) b.fm[f] = 1;
  const cap = rotZ(scale(move(G.genCone(4), [0, 0, 0.5]), [0.62, 0.62, 0.26]), 45);
  move(cap, [0, 0, 0.42]);
  return join([b, 0], [cap, 0]);
}

export function addLanterns(b: SceneBuilder): void {
  for (const [x, y] of CORNERS) {
    const g = b.group();
    b.place(lampPost(), [x, y, 0.3], [IRON], "Lamp post", g);
    b.place(lantern(), [x, y, 2.75], [IRON, LIGHT], "Lantern", g).script = SCRIPT;
  }
}
