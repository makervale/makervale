/** Sculptures on pedestals (a bloom that changes colour, a slowly turning twist) and planters by the steps. */
import * as G from "@/lib/mesh/generators";
import type { Mesh } from "@/lib/mesh/mesh";
import { faceNormal } from "@/lib/mesh/mesh";
import { extrude } from "@/lib/mesh/ops/extrude";
import { inset } from "@/lib/mesh/ops/inset";
import { loopCut } from "@/lib/mesh/ops/loop-cut";
import { subdivide } from "@/lib/mesh/ops/subdivide";
import { topologyOf } from "@/lib/mesh/topology";
import { crown } from "./nature";
import { LEAVES, MARBLE, TERRA } from "./palette";
import type { SceneBuilder } from "./place";
import { pedestal } from "./rotunda";
import { box, facesWhere, lathe, move, scale } from "./shapes";

const BLOOM_SCRIPT = `// Click it: it blooms and changes colour.
var i = 0
on touch {
  i = (i + 1) % 4
  if i == 0 { color "#ece6dc" } else if i == 1 { color "#f2a7b8" } else if i == 2 { color "#a7d3f2" } else { color "#f2dc8c" }
  grow 1.2 in 0.25
  grow 0.8333 in 0.35
}
`;

/** extrude the top and the four sides of a cube, then Subdivide twice */
function bloom(): Mesh {
  const m = scale(G.genBox(1), [0.55, 0.55, 0.55]);
  for (const f of facesWhere(m, (n) => n[2] > -0.5)) {
    const n = faceNormal(m, m.f[f]);
    const s = extrude(m, new Set([f]));
    for (const i of [...s.faces].flatMap((g) => m.f[g])) for (let k = 0; k < 3; k++) m.v[i][k] += n[k] * 0.32;
    inset(m, s.faces, 0.25, 0);
  }
  subdivide(m);
  subdivide(m);
  return move(m, [0, 0, 0.6]);
}

/** Loop cuts, then each ring turned a little more */
function twisted(): Mesh {
  const m = box([0.55, 0.55, 2.1]);
  const upright = [...topologyOf(m).edges].find(([, e]) => Math.abs(m.v[e.a][2] - m.v[e.b][2]) > 1);
  if (upright) loopCut(m, upright[0], 11);
  for (const v of m.v) {
    const a = (v[2] / 2.1) * Math.PI * 0.75;
    const [x, y] = v;
    v[0] = x * Math.cos(a) - y * Math.sin(a);
    v[1] = x * Math.sin(a) + y * Math.cos(a);
  }
  return m;
}

const planter = (): Mesh =>
  lathe(
    [
      [0, 0],
      [0.42, 0],
      [0.55, 0.55],
      [0.6, 0.6],
      [0.5, 0.6],
      [0.44, 0.12],
      [0, 0.12],
    ],
    20,
  );

export function addSculptures(b: SceneBuilder): void {
  b.place(pedestal(), [5.4, -4.4, 0.3], [MARBLE], "Pedestal");
  const polished = { ...MARBLE, name: "Polished marble", roughness: 0.18 };
  b.place(bloom(), [5.4, -4.4, 1.3], [polished], "Bloom").script = BLOOM_SCRIPT;
  b.place(pedestal(), [-5.4, -4.4, 0.3], [MARBLE], "Pedestal");
  b.place(twisted(), [-5.4, -4.4, 1.3], [TERRA], "Twist").script = "on start { spin 0, 0, -18 }\n";
}

/** planters with bushes beside the steps */
export function addPlanters(b: SceneBuilder): void {
  for (const x of [-2.1, 2.1]) {
    const g = b.group();
    b.place(planter(), [x, -2.9, 0.3], [TERRA], "Planter", g);
    const leaves = { name: "Leaves", color: LEAVES[2], roughness: 0.8 };
    b.place(crown(x > 0 ? 11 : 12, [0.95, 0.95, 0.8]), [x, -2.9, 0.98], [leaves], "Bush", g);
  }
}
