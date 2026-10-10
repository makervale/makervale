/** Objects & scene: duplicating, deleting, joining and grouping objects. */
import type { Need, Params, ToolContext } from "@/app/tools";
import { composeMatrix, invertAffine, transformMesh } from "@/lib/mesh/affine";
import { append } from "@/lib/mesh/ops/append";
import type { Obj } from "@/world/model";
import { cloneObj } from "@/world/model";
import type { CatalogTool, ToolApp } from "./app";

/** how far a duplicate lands from its original, in metres along X */
const DUPLICATE_OFFSET_M = 0.5;

export interface ObjectCard {
  id: string;
  name: string;
  key?: string;
  need: Need;
  synonyms: string[];
  summary: string;
  steps: string[];
  run: (c: ToolContext, p: Params, app: ToolApp) => string | void;
  extra?: Partial<CatalogTool>;
}

export const objectTool = (app: ToolApp, s: ObjectCard): CatalogTool => {
  const { extra, run, ...card } = s;
  return { ...card, category: "objects", run: (c, p) => run(c, p, app), ...extra };
};

/** the object the others join into or are cut by: the last one selected */
export function lastSelected(app: ToolApp, objs: Obj[]): Obj {
  return objs.find((o) => o.id === app.store.selection.last) ?? objs[objs.length - 1];
}

function duplicate(c: ToolContext): string {
  const groups = new Map<string, string>();
  const copies = c.objs.map((o) => {
    const n = cloneObj(o);
    n.id = "o" + c.world.seq++;
    n.pos[0] += DUPLICATE_OFFSET_M;
    return n;
  });
  for (const n of copies) {
    if (!n.group) continue;
    if (!groups.has(n.group)) groups.set(n.group, "g" + c.world.seq++);
    n.group = groups.get(n.group) ?? null;
  }
  copies.forEach((n) => c.addObj(n));
  c.selectObjects(copies.map((n) => n.id));
  return "Duplicated: " + copies.length;
}

function join(app: ToolApp, c: ToolContext): string {
  const root = lastSelected(app, c.objs);
  const toRoot = invertAffine(composeMatrix(root.pos, root.quat, root.size));
  for (const o of c.objs) {
    if (o === root) continue;
    // through world space into the root's space; two mirrorings cancel out
    const part = transformMesh(transformMesh(o.mesh, composeMatrix(o.pos, o.quat, o.size)), toRoot);
    const offset = root.materials.length;
    root.materials.push(...o.materials.map((m) => ({ ...m, name: o.name + ": " + m.name })));
    append(root.mesh, part, offset);
    c.removeObj(o.id);
  }
  root.group = null;
  c.selectObjects([root.id]);
  return "Joined into one mesh: " + root.mesh.f.length + " faces";
}

const CARDS: ObjectCard[] = [
  {
    id: "duplicate",
    name: "Duplicate",
    key: "Ctrl+D",
    need: "objects",
    synonyms: ["duplicate", "copy", "clone", "instance", "make copy"],
    summary:
      "Makes a copy of the selected objects next to the original. Shift+drag on an arrow does the same while moving.",
    steps: ["Select objects.", "Ctrl+D."],
    run: duplicate,
    extra: { pie: true },
  },
  {
    id: "delete",
    name: "Delete object",
    key: "Del",
    need: "objects",
    synonyms: ["delete", "delete object", "remove", "erase", "trash"],
    summary: "Deletes the selected objects.",
    steps: ["Select objects.", "Delete."],
    run: (c) => {
      const n = c.objs.length;
      for (const o of c.objs) c.removeObj(o.id);
      c.selectObjects([]);
      return "Deleted: " + n;
    },
    extra: { pie: true },
  },
  {
    id: "join",
    name: "Join meshes",
    key: "Ctrl+J",
    need: "objects2",
    synonyms: ["join", "combine", "attach", "merge objects", "one mesh", "join objects"],
    summary: "Joins the selected objects into one mesh. Materials are added together. The last selected object stays.",
    steps: ["Select objects (Shift+click).", "Ctrl+J."],
    run: (c, _p, app) => join(app, c),
  },
  {
    id: "group",
    name: "Group",
    key: "Ctrl+G",
    need: "objects2",
    synonyms: ["group", "link", "parent", "set", "bundle", "keep together"],
    summary: "Groups objects so clicking one selects them all. The meshes stay separate.",
    steps: [
      "Select objects.",
      "Ctrl+G.",
      'The "Select parts separately" option lets you edit single members of the group.',
    ],
    run: (c) => {
      const gid = "g" + c.world.seq++;
      for (const o of c.objs) o.group = gid;
      return "Grouped " + c.objs.length + " objects";
    },
  },
  {
    id: "ungroup",
    name: "Ungroup",
    key: "Ctrl+Shift+G",
    need: "objects",
    synonyms: ["ungroup", "unlink", "unparent", "break group", "split group"],
    summary: "Breaks a group into independent objects.",
    steps: ["Select a group.", "Ctrl+Shift+G."],
    run: (c) => {
      for (const o of c.objs) o.group = null;
      return "Ungrouped";
    },
  },
];

export const objectTools = (app: ToolApp): CatalogTool[] => CARDS.map((s) => objectTool(app, s));
