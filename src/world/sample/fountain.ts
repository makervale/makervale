/** The fountain with its wishing-coin script, and the benches facing it. */
import type { Mesh } from "@/lib/mesh/mesh";
import { arrayLinear } from "@/lib/mesh/ops/array";
import { IRON, MARBLE, STONE, WATER, WOOD } from "./palette";
import type { SceneBuilder } from "./place";
import { ONE, box, disc, join, lathe, rotZ } from "./shapes";

const SCRIPT = `// Toss a coin.
var coins = 0
on touch {
  coins += 1
  say who + " tosses a coin into the fountain. Make a wish! (" + coins + " coins so far)"
}
`;

const basin = (): Mesh =>
  lathe(
    [
      [0, 0],
      [1.7, 0],
      [1.7, 0.5],
      [1.78, 0.56],
      [1.78, 0.64],
      [1.5, 0.64],
      [1.5, 0.16],
      [0, 0.16],
    ],
    40,
  );

const bowl = (): Mesh =>
  lathe(
    [
      [0, 0.16],
      [0.32, 0.16],
      [0.22, 0.4],
      [0.16, 1.05],
      [0.24, 1.15],
      [0.72, 1.32],
      [0.76, 1.4],
      [0.64, 1.4],
      [0.22, 1.28],
      [0, 1.28],
    ],
    32,
  );

/** slats made with Array, iron legs, everything joined */
function bench(): Mesh {
  const slat = box([0.09, 1.8, 0.05], [-0.24, 0, 0.42]);
  arrayLinear(slat, 5, [0.12, 0, 0], ONE);
  const back = box([0.05, 1.8, 0.09], [-0.34, 0, 0.62]);
  arrayLinear(back, 2, [0, 0, 0.18], ONE);
  const legs = join(
    ...[-0.72, 0.72].flatMap((y): [Mesh, number][] => [
      [box([0.62, 0.07, 0.06], [0, y, 0.36]), 0],
      [box([0.06, 0.07, 0.36], [0.24, y, 0]), 0],
      [box([0.06, 0.07, 0.96], [-0.3, y, 0]), 0],
    ]),
  );
  return join([slat, 0], [back, 0], [legs, 1]);
}

export function addFountain(b: SceneBuilder): void {
  const g = b.group();
  b.place(basin(), [0, -5.2, 0.3], [STONE], "Fountain basin", g).script = SCRIPT;
  b.place(disc(1.52, 0.02), [0, -5.2, 0.78], [WATER], "Water", g);
  b.place(bowl(), [0, -5.2, 0.3], [MARBLE], "Fountain bowl", g);
  b.place(disc(0.66, 0.02), [0, -5.2, 1.62], [WATER], "Water (bowl)", g);
  // benches face the fountain
  b.place(rotZ(bench(), 0), [-3.3, -5.2, 0.3], [WOOD, IRON], "Bench");
  b.place(rotZ(bench(), 180), [3.3, -5.2, 0.3], [WOOD, IRON], "Bench");
}
