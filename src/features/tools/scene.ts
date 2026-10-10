/** Objects & scene: placing, pivots, size, hiding and locking. */
import type { ToolContext } from "@/app/tools";
import { composeMatrix, transformPoint } from "@/lib/mesh/affine";
import { boundsOf } from "@/lib/mesh/bounds";
import type { Vec3 } from "@/lib/vec";
import { add, mul3, rotate } from "@/lib/vec";
import type { CatalogTool, ToolApp } from "./app";
import { intParam, objOf } from "./helpers";
import type { ObjectCard } from "./objects";
import { objectTool } from "./objects";

function dropToGround(c: ToolContext): void {
  let minZ = Infinity;
  for (const o of c.objs) {
    const toWorld = composeMatrix(o.pos, o.quat, o.size);
    for (const v of o.mesh.v) minZ = Math.min(minZ, transformPoint(toWorld, v)[2]);
  }
  for (const o of c.objs) o.pos[2] -= minZ;
}

/** moves the pivot to the centre of the shape (where = 0) or of its base (where = 1); the shape stays put */
function setPivot(c: ToolContext, where: number): void {
  const o = objOf(c);
  const b = boundsOf(o.mesh.v);
  const centre: Vec3 = [
    (b.lo[0] + b.hi[0]) / 2,
    (b.lo[1] + b.hi[1]) / 2,
    where === 1 ? b.lo[2] : (b.lo[2] + b.hi[2]) / 2,
  ];
  for (const v of o.mesh.v) for (let k = 0; k < 3; k++) v[k] -= centre[k];
  o.pos = add(o.pos, rotate(mul3(centre, o.size), o.quat));
}

function showAll(c: ToolContext, app: ToolApp): string {
  let n = 0;
  for (const o of c.world.objects) {
    if (!o.hidden) continue;
    app.commands.history.touch(o.id);
    o.hidden = false;
    n++;
  }
  return n ? "Shown: " + n : "Nothing was hidden";
}

const CARDS: ObjectCard[] = [
  {
    id: "ground",
    name: "Drop to ground",
    need: "objects",
    synonyms: ["drop to ground", "ground", "floor", "drop", "lower", "gravity", "snap to floor"],
    summary: "Lowers the selection so its lowest point touches the ground.",
    steps: ["Select objects.", "Pick Drop to ground."],
    run: dropToGround,
  },
  {
    id: "origin",
    name: "Set pivot",
    need: "obj1",
    synonyms: ["origin", "pivot", "set origin", "center", "rotation point", "anchor"],
    summary:
      "Moves the point the object rotates and scales around, without moving the shape itself. Game engines use it as the object's position.",
    steps: ["Select an object.", "Pick where the point should be."],
    run: (c, p) => setPivot(c, p.where),
    extra: { params: [{ ...intParam("where", "Where", 0, 1, 1), options: ["center of shape", "center of base"] }] },
  },
  {
    id: "applysize",
    name: "Apply size",
    need: "obj1",
    synonyms: ["apply scale", "apply size", "apply transform", "reset xform", "freeze transformations", "scale 1"],
    summary:
      "Writes the object's size into the mesh itself, so the scale becomes 1. Required by some engines and before printing.",
    steps: ["Select an object.", "Pick Apply size."],
    run: (c) => {
      const o = objOf(c);
      for (const v of o.mesh.v) for (let k = 0; k < 3; k++) v[k] *= o.size[k];
      o.size = [1, 1, 1];
    },
  },
  {
    id: "hide",
    name: "Hide",
    key: "H",
    need: "objects",
    synonyms: ["hide", "invisible", "hide object", "conceal", "out of the way"],
    summary:
      "Hides the selected objects so they don't block your work. Show them again in the Scene panel or with Shift+H.",
    steps: ["Select objects.", "H."],
    run: (c) => {
      for (const o of c.objs) o.hidden = true;
      c.selectObjects([]);
    },
  },
  {
    id: "unhide",
    name: "Show all",
    key: "Shift+H",
    need: "none",
    synonyms: ["unhide", "show all", "show", "reveal", "unhide all"],
    summary: "Brings back all hidden objects.",
    steps: ["Shift+H."],
    run: (c, _p, app) => showAll(c, app),
  },
  {
    id: "lock",
    name: "Lock",
    need: "objects",
    synonyms: ["lock", "freeze", "unlock", "protect", "don't move"],
    summary: "Locks objects against accidental moving and editing. Use it again to unlock.",
    steps: ["Select objects.", "Pick Lock."],
    run: (c) => {
      const locked = !c.objs.every((o) => o.locked);
      for (const o of c.objs) o.locked = locked;
      return locked ? "Locked" : "Unlocked";
    },
  },
  {
    id: "focus",
    name: "Focus camera",
    key: "F",
    need: "objects",
    synonyms: ["focus", "frame", "frame selected", "zoom to", "view selected", "camera", "show selection"],
    summary: "Points the camera at the selection. Alt+click does the same at any point.",
    steps: ["Select an object.", "F."],
    run: (_c, _p, app) => app.bus.emit("menu:command", { command: "focus" }),
    extra: { kind: "command" },
  },
];

export const sceneTools = (app: ToolApp): CatalogTool[] => CARDS.map((s) => objectTool(app, s));
