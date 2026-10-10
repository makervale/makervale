/**
 * Things to play with on the plaza: a trampoline in the east corner (bounce high enough to reach the rotunda's
 * cornice) and a row of chimes in the west corner, each bar a note of the C major scale.
 */
import * as G from "@/lib/mesh/generators";
import type { Mesh } from "@/lib/mesh/mesh";
import type { Mat } from "./palette";
import { IRON, WOOD } from "./palette";
import type { SceneBuilder } from "./place";
import { box, disc, join, move, scale } from "./shapes";

/** the plaza's paving is this high */
const PLAZA_TOP = 0.3;
/** launch speed: about five metres up */
const TRAMPOLINE_SPRING_M_S = 10;
const MAT_RADIUS = 1.05;

const PADDING: Mat = { name: "Padding", color: "#2f78c9", roughness: 0.7 };
const MAT: Mat = { name: "Trampoline mat", color: "#202226", roughness: 0.9 };

/** low enough to step onto: legs, a black mat, a padded rim */
function trampoline(): Mesh {
  const rim = G.genTorus(40, 0.12);
  scale(rim, [MAT_RADIUS * 2 + 0.2, MAT_RADIUS * 2 + 0.2, 0.12]);
  move(rim, [0, 0, 0.36]);
  const mat = move(disc(MAT_RADIUS, 0.03), [0, 0, 0.33]);
  const legs: [Mesh, number][] = [];
  for (let i = 0; i < 6; i++) {
    const a = (i / 6) * Math.PI * 2;
    legs.push([box([0.07, 0.07, 0.33], [Math.cos(a) * MAT_RADIUS, Math.sin(a) * MAT_RADIUS, 0]), 2]);
  }
  return join([rim, 0], [mat, 1], ...legs);
}

/** C major from middle C up an octave, rainbow-coloured, longest bar lowest */
const NOTES = [0, 2, 4, 5, 7, 9, 11, 12];
const BAR_COLORS = ["#e04a3f", "#ee8a2f", "#f1c63a", "#7cc443", "#39b39a", "#3a8fe0", "#6b5fd6", "#c45bc9"];
const BAR_GAP = 0.42;
/** box() stands on its z: legs from the paving up, rails on the legs, bars on the rails */
const LEG_H = 0.72;
const RAIL = 0.06;
const BARS_REST_ON = LEG_H + RAIL;

const chimeScript = (note: number) => `// Tap me: I play a note, and everyone nearby hears it. Try a tune!
on touch {
  play ${note}, "marimba"
  glow 0.7
  wait 0.25
  glow 0
}
`;

function stand(): Mesh {
  const len = BAR_GAP * NOTES.length;
  const rail = (x: number) => box([RAIL, len, RAIL], [x, len / 2 - BAR_GAP / 2, LEG_H]);
  const leg = (x: number, y: number) => box([0.06, 0.06, LEG_H], [x, y, 0]);
  const ends = [-BAR_GAP / 2 + 0.05, len - BAR_GAP / 2 - 0.05];
  const legs = ends.flatMap((y) => [leg(-0.32, y), leg(0.32, y)]);
  return join([rail(-0.32), 0], [rail(0.32), 0], ...legs.map((l): [Mesh, number] => [l, 1]));
}

export function addPlayground(b: SceneBuilder): void {
  b.place(trampoline(), [6.1, 3.4, PLAZA_TOP], [PADDING, MAT, IRON], "Trampoline").spring = TRAMPOLINE_SPRING_M_S;
  const g = b.group();
  const x = -6.3;
  const y0 = 1.2;
  b.place(stand(), [x, y0, PLAZA_TOP], [WOOD, IRON], "Chimes stand", g);
  NOTES.forEach((note, i) => {
    const len = 0.95 - i * 0.05;
    const bar = box([len, 0.32, 0.06], [0, 0, 0]);
    const color: Mat = { name: "Chime", color: BAR_COLORS[i], roughness: 0.3, metalness: 0.4 };
    const o = b.place(bar, [x, y0 + i * BAR_GAP, PLAZA_TOP + BARS_REST_ON], [color], "Chime " + (i + 1), g);
    o.script = chimeScript(note);
  });
}
