/** Faces that become their own object, or their own piece of the mesh. */
import type { ToolContext } from "@/app/tools";
import * as G from "@/lib/mesh/generators";
import { cloneMesh } from "@/lib/mesh/mesh";
import { extract } from "@/lib/mesh/ops/delete";
import { splitFaces } from "@/lib/mesh/ops/split-faces";
import { selectedFaces } from "@/lib/mesh/selection";
import { cloneObj } from "@/world/model";
import type { Mesh } from "@/lib/mesh/mesh";
import type { CatalogTool } from "./app";
import { meshOf, objOf, sel, topFaces } from "./helpers";

const selFaces = (c: ToolContext) => selectedFaces(meshOf(c), c.selection);
const topOfBox2 = { mesh: () => G.genBox(2), selection: (m: Mesh) => sel(topFaces(m)), mode: "face" as const };

/** a new object with the original's look, holding `part` */
function newPartObject(c: ToolContext, part: Mesh, suffix: string): void {
  const o = objOf(c);
  const n = cloneObj(o);
  n.id = "o" + c.world.seq++;
  n.mesh = part;
  n.name = o.name + suffix;
  n.group = null;
  c.addObj(n);
  c.selectObjects([n.id]);
  c.setMode("object");
}

const SPLIT: CatalogTool = {
  id: "split",
  name: "Separate to object",
  category: "faces",
  need: "faces",
  pie: true,
  synonyms: ["separate", "split", "detach", "take out", "separate object", "break off"],
  summary: "Moves the selected faces to a new object. The original is left without them.",
  steps: ["Select faces.", "Pick Separate to object."],
  run: (c) => {
    const m = meshOf(c);
    const faces = selFaces(c);
    if (faces.size >= m.f.length) throw new Error("All faces are selected");
    newPartObject(c, extract(m, faces), " (part)");
    return "Separated into a new object";
  },
  demo: topOfBox2,
  related: ["dupfaces", "join"],
};

const DUPLICATE_FACES: CatalogTool = {
  id: "dupfaces",
  name: "Copy faces to object",
  category: "faces",
  need: "faces",
  synonyms: ["duplicate faces", "copy faces", "copy part", "extract", "copy to object"],
  summary: "Copies the selected faces to a new object without touching the original.",
  steps: ["Select faces.", "Pick Copy faces to object."],
  run: (c) => {
    newPartObject(c, extract(cloneMesh(meshOf(c)), selFaces(c)), " (copy)");
  },
  demo: topOfBox2,
  related: ["split"],
};

const DETACH: CatalogTool = {
  id: "detach",
  name: "Detach faces",
  category: "faces",
  need: "faces",
  synonyms: ["split", "detach", "rip", "tear off", "separate in place", "cut loose"],
  summary: "Tears the selected faces off the rest of the mesh (they stay in the same object, but share no points).",
  steps: ["Select faces.", "Choose Detach faces, then move them with the arrow."],
  run: (c) => {
    c.setSelection(splitFaces(meshOf(c), selFaces(c)));
  },
  demo: topOfBox2,
  demoRun: (c) => {
    const m = meshOf(c);
    const s = splitFaces(m, selFaces(c));
    for (const f of s.faces) for (const i of m.f[f]) m.v[i][2] += 0.25;
    c.setSelection(s);
  },
  related: ["split", "spike"],
};

export const separateTools = (): CatalogTool[] => [SPLIT, DUPLICATE_FACES];

export const detachTool = (): CatalogTool => DETACH;
