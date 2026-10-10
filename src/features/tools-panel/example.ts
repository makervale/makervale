/** "Try on an example": put the scene from a tool's illustration into the world, selected like in the picture. */
import type { ToolDef } from "@/app/tools";
import { cloneSelection, emptySelection } from "@/lib/mesh/selection";
import type { Vec3 } from "@/lib/vec";
import type { Obj } from "@/world/model";
import { newObj } from "@/world/model";
import { toast } from "@/ui/toast";
import type { Panel } from "./panel";

const GAP_M = 3;
const LIFT_M = 0.02;
const FRAME_K = 2.4;
const KEY_MAX = 8;

/** to the right of everything visible, standing on the ground */
export function examplePlace(objs: Obj[], size: Vec3): Vec3 {
  const visible = objs.filter((o) => !o.hidden);
  if (!visible.length) return [0, 0, size[2] / 2 + LIFT_M];
  const xs = visible.map((o) => o.pos[0]);
  const ys = visible.map((o) => o.pos[1]);
  const midY = (Math.min(...ys) + Math.max(...ys)) / 2;
  return [Math.max(...xs) + GAP_M, midY, size[2] / 2 + LIFT_M];
}

function hint(t: ToolDef): string {
  if (t.kind === "mode") return "try " + t.name;
  const how = t.key && t.key.length < KEY_MAX ? "the " + t.key + " key" : "use the pie menu";
  return 'press "Start tool" or ' + how;
}

export function tryExample(p: Panel, t: ToolDef): void {
  const demo = t.demo;
  if (!demo) return;
  const { store, commands, renderer } = p.deps;
  const mesh = demo.mesh();
  const selection = demo.selection ? cloneSelection(demo.selection(mesh)) : emptySelection();
  const size: Vec3 = demo.size ?? [1, 1, 1];
  const o = newObj(store.world, mesh, examplePlace(store.world.objects, size), size, { name: "Example: " + t.name });
  if (!commands.act("Example: " + t.name, [], () => store.world.objects.push(o))) return;
  commands.setToolMode("edit");
  commands.selectObjects([o.id]);
  const mode = demo.mode ?? "object";
  if (mode !== "object") {
    commands.setMode(mode);
    commands.setElements(selection);
  }
  renderer.framing.frame([o], undefined, FRAME_K);
  toast(`Example added. Now ${hint(t)}`);
}
