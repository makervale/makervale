/** A lift east of the plaza: stand on it and click it. */
import * as G from "@/lib/mesh/generators";
import { STONE } from "./palette";
import type { SceneBuilder } from "./place";
import { move, scale } from "./shapes";

const SCRIPT = `// Stand on it and click it: up to the treetops and back.
var busy = false
on touch {
  if busy { stop }
  busy = true
  say "Going up!"
  move 0, 0, 5 in 4
  wait 6
  home in 4
  busy = false
}
`;

export function addLift(b: SceneBuilder): void {
  const platform = scale(move(G.genCylinder(32), [0, 0, 0.5]), [1.9, 1.9, 0.16]);
  b.place(platform, [9.8, 0, 0], [{ ...STONE, name: "Lift stone" }], "Lift").script = SCRIPT;
}
