/** The south gate that greets visitors, and the railings along the east and west edges. */
import type { Mesh } from "@/lib/mesh/mesh";
import { arrayLinear } from "@/lib/mesh/ops/array";
import { MARBLE, STONE } from "./palette";
import type { SceneBuilder } from "./place";
import { ONE, bevelSharp, box, join, lathe, move, revolve, rotZ } from "./shapes";

const SCRIPT = `// Says hello to everyone who comes in.
on near 2.5 { say "Welcome to the plaza, " + who + "! Tap the lanterns, the door and the chimes, bounce on the trampoline, and kick the ball on the pitch behind the rotunda. On a computer, Build (bottom left) lets you make your own." }
`;

/** pillars plus an arch made by spinning a rectangle half a turn around Y */
function gate(): Mesh {
  const arch = revolve(
    [
      [1.9, -0.3, 0],
      [2.5, -0.3, 0],
      [2.5, 0.3, 0],
      [1.9, 0.3, 0],
    ],
    [0, 1, 0],
    -180,
    14,
  );
  move(arch, [0, 0, 2.6]);
  const pillar = (x: number) => bevelSharp(box([0.75, 0.75, 2.6], [x, 0, 0]), 0.04, 1);
  const key = bevelSharp(box([0.42, 0.66, 0.5], [0, 0, 2.6 + 2.32]), 0.03, 1);
  return join([pillar(-2.2), 0], [pillar(2.2), 0], [arch, 0], [key, 0]);
}

/** balusters from Spin, repeated with Array, joined with two rails */
function fence(): Mesh {
  const b = lathe(
    [
      [0, 0.06],
      [0.065, 0.06],
      [0.065, 0.11],
      [0.045, 0.15],
      [0.06, 0.33],
      [0.035, 0.56],
      [0.05, 0.62],
      [0, 0.62],
    ],
    8,
  );
  move(b, [-2.75, 0, 0]);
  arrayLinear(b, 12, [0.5, 0, 0], ONE);
  const top = bevelSharp(box([5.9, 0.12, 0.08], [0, 0, 0.62]), 0.015, 1);
  const base = box([5.9, 0.16, 0.06], [0, 0, 0]);
  return join([b, 0], [top, 0], [base, 0]);
}

export function addRailings(b: SceneBuilder): void {
  for (const x of [7.75, -7.75])
    for (const y of [-4.1, 4.1]) b.place(rotZ(fence(), 90), [x, y, 0.3], [MARBLE], "Railing");
}

export function addGate(b: SceneBuilder): void {
  b.place(gate(), [0, -8.75, 0], [STONE], "Gate").script = SCRIPT;
}
