/** Vertices: merging, connecting, deleting points and pulling spikes. */
import type { ToolContext } from "@/app/tools";
import * as G from "@/lib/mesh/generators";
import { connectVerts } from "@/lib/mesh/ops/connect";
import { deleteVerts } from "@/lib/mesh/ops/delete";
import { mergeAtCenter } from "@/lib/mesh/ops/merge";
import { spikeVertex } from "@/lib/mesh/ops/spike";
import { emptySelection, selectedVerts } from "@/lib/mesh/selection";
import type { Vec3 } from "@/lib/vec";
import { div3, normalize, rotate } from "@/lib/vec";
import type { CatalogTool } from "./app";
import { meshOf, moveVerts, sel, sizeOf, topFaces, topVerts, vertNormal } from "./helpers";

const selVerts = (c: ToolContext) => selectedVerts(meshOf(c), c.selection);
const box1 = () => G.genBox(1);

/** the world direction of the selected vertex's normal */
function spikeAxis(c: ToolContext): Vec3 | null {
  const v = [...c.selection.verts][0];
  if (v === undefined) return null;
  const n = vertNormal(meshOf(c), v);
  // normals take the inverse scale: a squashed object's normals tilt the other way
  return normalize(c.obj ? rotate(div3(n, c.obj.size), c.obj.quat) : n);
}

const VERT_TOOLS: CatalogTool[] = [
  {
    id: "merge",
    name: "Merge at center",
    category: "verts",
    key: "M",
    need: "verts2",
    pie: true,
    synonyms: ["merge", "merge at center", "collapse", "weld", "join points", "one point"],
    summary: "Glues the selected points into one, at their center.",
    steps: ["Select points.", "Press M."],
    run: (c) => {
      c.setMode("vert");
      c.setSelection(mergeAtCenter(meshOf(c), selVerts(c)));
    },
    demo: { mesh: box1, selection: (m) => sel([], [], topVerts(m)), mode: "vert" },
    related: ["weld", "connect"],
  },
  {
    id: "connect",
    name: "Connect vertices",
    category: "verts",
    key: "J",
    need: "verts2",
    pie: true,
    synonyms: [
      "connect",
      "connect vertices",
      "join vertices",
      "vertex connect",
      "split face",
      "simple knife",
      "add edge",
    ],
    summary: "Runs a new edge across a face between two selected points. The simplest knife.",
    steps: ["Select two points of the same face (not neighbours).", "Press J."],
    run: (c) => {
      const s = connectVerts(meshOf(c), selVerts(c));
      if (!s.edges.size) throw new Error("The points must lie on the same face and not be neighbours");
      c.setMode("edge");
      c.setSelection(s);
    },
    demo: {
      mesh: box1,
      selection: (m) => {
        const p = m.f[topFaces(m)[0]];
        return sel([], [], [p[0], p[2]]);
      },
      mode: "vert",
    },
    related: ["loopcut", "dissolve"],
  },
  {
    id: "delverts",
    name: "Delete vertices",
    category: "verts",
    need: "elems",
    synonyms: ["delete vertices", "delete vertex", "delete point", "remove point", "erase"],
    summary: "Deletes the selected points and all faces that used them.",
    steps: ["Select points.", "Press Delete."],
    run: (c) => {
      deleteVerts(meshOf(c), selVerts(c));
      c.setSelection(emptySelection());
    },
    demo: { mesh: box1, selection: (m) => sel([], [], [topVerts(m)[0]]), mode: "vert" },
  },
];

const SPIKE: CatalogTool = {
  id: "spike",
  name: "Spike",
  category: "verts",
  need: "vert1",
  synonyms: ["spike", "point", "pull vertex", "horn", "tip", "cone from vertex", "poke"],
  summary: "Pulls a spike out of a vertex. Shift+drag on a vertex does the same by hand.",
  steps: ["Select one vertex.", "Move the mouse to set the spike height, the wheel sets the width of its base."],
  params: [
    { key: "h", label: "Height", min: -50, max: 50, step: 0.01, def: 0.3, decimals: 3, unit: "m" },
    { key: "r", label: "Base", min: 0.002, max: 10, step: 0.01, def: 0.08, decimals: 3, unit: "m" },
  ],
  live: { param: "h", mode: "axis", wheel: "r", axis: spikeAxis },
  run: (c, p) => {
    const m = meshOf(c);
    const v = [...c.selection.verts][0];
    const n = vertNormal(m, v);
    const { sel: s, tip } = spikeVertex(m, v, p.r, sizeOf(c));
    moveVerts(m, [tip], c.localOffset(n, p.h));
    c.setMode("vert");
    c.setSelection(s);
  },
  demo: {
    mesh: () => G.genSphere(12),
    selection: (m) => sel([], [], [m.v.findIndex((p) => p[2] > 0.49)]),
    mode: "vert",
    params: { h: 0.35, r: 0.12 },
  },
  related: ["extrude", "merge"],
};

export const vertTools = (): CatalogTool[] => VERT_TOOLS;

export const spikeTool = (): CatalogTool => SPIKE;
