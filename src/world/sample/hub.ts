/** The middle of the plaza: the hall of fame every game reports to, and the guide who greets newcomers. */
import * as G from "@/lib/mesh/generators";
import type { Mesh } from "@/lib/mesh/mesh";
import guide from "./scripts/guide.lua";
import hall from "./scripts/hall.lua";
import type { Mat } from "./palette";
import { GOLD, MARBLE, STONE } from "./palette";
import { PLAZA_TOP } from "./ground";
import type { SceneBuilder } from "./place";
import { box, join, lathe, move, scale } from "./shapes";

const ROBOT: Mat = { name: "Robot shell", color: "#f1f3f6", roughness: 0.35, metalness: 0.2 };
const VISOR: Mat = { name: "Visor", color: "#1b2433", roughness: 0.2, metalness: 0.4 };
const EYES: Mat = { name: "Eyes", color: "#62e0ff", roughness: 0.3, emissive: 1.2 };

/** a stone slab on a plinth, with a gold band at the top */
function monolith(): Mesh {
  return join([box([3, 1.2, 0.3], [0, 0, 0]), 0], [box([2.4, 0.6, 2.6], [0, 0, 0.3]), 1], [box([2.5, 0.7, 0.18], [0, 0, 2.9]), 2]);
}

/** a friendly round robot: a body like a bell, a round head with a dark visor and two glowing eyes */
function robot(): Mesh {
  const body = lathe(
    [
      [0, 0],
      [0.32, 0],
      [0.42, 0.25],
      [0.36, 0.9],
      [0.22, 1.05],
      [0, 1.05],
    ],
    24,
  );
  const head = move(scale(G.genSphere(20), [0.62, 0.62, 0.56]), [0, 0, 1.35]);
  const visor = move(scale(G.genSphere(16), [0.5, 0.2, 0.26]), [0, -0.22, 1.37]);
  const eye = (x: number) => move(scale(G.genSphere(10), [0.09, 0.05, 0.09]), [x, -0.33, 1.38]);
  return join([body, 0], [head, 0], [visor, 1], [eye(-0.1), 2], [eye(0.1), 2]);
}

export function addHub(b: SceneBuilder): void {
  b.place(monolith(), [0, 0, PLAZA_TOP], [STONE, MARBLE, GOLD], "Hall of Fame").script = hall;
  b.place(robot(), [2.6, -9.6, PLAZA_TOP], [ROBOT, VISOR, EYES], "Guide").script = guide;
}
