/** The geode in the rotunda: a rough rock cut open with Plane cut, its cut face filled and set with crystal. */
import * as G from "@/lib/mesh/generators";
import type { Mesh } from "@/lib/mesh/mesh";
import { bisect } from "@/lib/mesh/ops/bisect";
import { inset } from "@/lib/mesh/ops/inset";
import { AMETHYST, ROCK } from "./palette";
import type { SceneBuilder } from "./place";
import { jitter, move, scale } from "./shapes";

const SCRIPT = `// Turns slowly; click to make the crystal flare.
on start { spin 0, 0, 12 }
on touch {
  say "The crystal hums."
  repeat 3 { glow 1.5, 2; wait 0.25; glow 0.35, 2; wait 0.25 }
}
`;

function geode(): Mesh {
  const m = scale(G.genIcosphere(2), [0.9, 0.9, 0.8]);
  jitter(m, 0.12, 5);
  move(m, [0, 0, 0.4]);
  const cut = bisect(m, null, { p: [0, 0.08, 0.45], n: [0, -0.8, 0.6] }, { remove: "front", fill: true });
  for (const f of cut.faces) {
    m.fm[f] = 1;
    inset(m, new Set([f]), 0.18, -0.12);
    m.fm[f] = 1;
  }
  return m;
}

export function addCrystal(b: SceneBuilder, group: string): void {
  b.place(geode(), [0, 2.5, 1.9], [ROCK, AMETHYST], "Geode", group).script = SCRIPT;
}
