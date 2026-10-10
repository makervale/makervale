/** The cottage door: fills the opening when shut, swings 90° inwards about its hinge when clicked. */
import type { Mesh } from "@/lib/mesh/mesh";
import { inset } from "@/lib/mesh/ops/inset";
import type { Obj } from "@/world/model";
import { WOOD } from "./palette";
import type { SceneBuilder } from "./place";
import { box, facesWhere, move } from "./shapes";

/** where the hinge sits, relative to the cottage centre, in metres: in the middle of the wall, at the opening's edge */
const HINGE_X = 1.9;
const HINGE_Y = -0.34;

function door(): Mesh {
  const m = box([0.06, 0.98, 1.98], [0, 0.49, 0.16]);
  inset(
    m,
    facesWhere(m, (n) => n[0] > 0.9),
    0.12,
    -0.02,
  );
  return move(m, [HINGE_X, HINGE_Y, 0]);
}

/** the script swings the door about its hinge, given in the door's unit space */
function doorScript(px: number, py: number): string {
  return `// The cottage door: click to open it, click again to shut it.
var open = false
on start { pivot ${px.toFixed(3)}, ${py.toFixed(3)}, 0 }
on touch {
  open = not open
  if open { turn 0, 0, 90 in 0.9 } else { turn 0, 0, -90 in 0.9 }
}
`;
}

export function addDoor(b: SceneBuilder, cx: number, cy: number, group: string): Obj {
  const o = b.place(door(), [cx, cy, 0], [WOOD], "Door", group);
  const px = (cx + HINGE_X - o.pos[0]) / o.size[0];
  const py = (cy + HINGE_Y - o.pos[1]) / o.size[1];
  o.script = doorScript(px, py);
  return o;
}
