/** The plaza itself: a round paved square with a low stone rim, and the paths out to the pitch. */
import type { Mesh } from "@/lib/mesh/mesh";
import { STONE, TILES } from "./palette";
import type { SceneBuilder } from "./place";
import { box, disc, join, lathe } from "./shapes";

export const PLAZA_R = 16;
/** the paving is this high: everything on the plaza stands on it */
export const PLAZA_TOP = 0.3;

function paving(): Mesh {
  const top = disc(PLAZA_R, PLAZA_TOP);
  // the path towards the pitch: the same paving, north out of the square
  // it ends short of the net behind the south goal
  const path = box([3, 2.6, PLAZA_TOP], [0, PLAZA_R + 0.8, 0]);
  return join([top, 1], [path, 1]);
}

/** a kerb round the edge, low enough to step over */
const rim = (): Mesh =>
  lathe(
    [
      [PLAZA_R - 0.35, 0],
      [PLAZA_R + 0.25, 0],
      [PLAZA_R + 0.25, PLAZA_TOP + 0.15],
      [PLAZA_R - 0.35, PLAZA_TOP + 0.15],
    ],
    72,
  );

export function addGround(b: SceneBuilder): void {
  b.place(paving(), [0, 0, 0], [STONE, TILES], "Plaza");
  b.place(rim(), [0, 0, 0], [STONE], "Plaza rim");
}
