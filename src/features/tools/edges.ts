/** Edges: cutting, bevelling and dissolving edges. */
import type { ToolContext } from "@/app/tools";
import { bevel } from "@/lib/mesh/bevel";
import * as G from "@/lib/mesh/generators";
import { connectVerts, dissolveEdges, insertVertexOnEdge } from "@/lib/mesh/ops/connect";
import { deleteEdges } from "@/lib/mesh/ops/delete";
import { loopCut } from "@/lib/mesh/ops/loop-cut";
import { emptySelection, selectedEdges } from "@/lib/mesh/selection";
import { topologyOf } from "@/lib/mesh/topology";
import type { Mesh } from "@/lib/mesh/mesh";
import type { CatalogTool } from "./app";
import { intParam, meshOf, sel, sizeOf, topFaces, topLoop, verticalEdge } from "./helpers";

const selEdges = (c: ToolContext) => selectedEdges(meshOf(c), c.selection);

/** the edges between two top faces of a 2×2 box */
function innerTopEdges(m: Mesh): string[] {
  const top = topFaces(m);
  return [...topologyOf(m).edges.entries()]
    .filter(([, e]) => e.faces.length === 2 && e.faces.every((f) => top.includes(f)))
    .map(([k]) => k);
}

const LOOP_CUT: CatalogTool = {
  id: "loopcut",
  name: "Loop cut",
  category: "edges",
  key: "Ctrl+R",
  need: "mesh",
  pie: true,
  synonyms: ["loop cut", "cut", "add edge loop", "add edge", "slice across", "more geometry", "swift loop"],
  summary:
    "Cuts the shape with a loop running across the selected edge. Adds room for new shape without breaking the mesh.",
  steps: [
    "In Edges mode, select the edge the loop should cut.",
    "Pick Loop cut.",
    "Set the number of cuts in the last-operation panel.",
  ],
  params: [intParam("n", "Number of cuts", 1, 32, 1)],
  live: { pick: "edge", wheel: "n" },
  run: (c, p) => {
    const first = [...c.selection.edges][0];
    if (first === undefined) throw new Error("Click the edge the loop should pass through");
    const s = loopCut(meshOf(c), first, p.n);
    if (!s.edges.size) throw new Error("No loop runs through this edge");
    c.setMode("edge");
    c.setSelection({ ...emptySelection(), edges: s.edges });
  },
  demo: {
    mesh: () => G.genCylinder(12, 1),
    selection: (m) => sel([], [verticalEdge(m)]),
    mode: "edge",
    params: { n: 2 },
  },
  related: ["ring", "connect"],
};

const DISSOLVE: CatalogTool = {
  id: "dissolve",
  name: "Dissolve edges",
  category: "edges",
  need: "edges",
  synonyms: ["dissolve", "dissolve edges", "remove edge keep face", "join faces", "merge faces", "remove edge loop"],
  summary: "Removes the edge between two faces and joins them into one, without making a hole.",
  steps: ["Select edges.", "Pick Dissolve edges."],
  run: (c) => {
    dissolveEdges(meshOf(c), selEdges(c));
    c.setSelection(emptySelection());
  },
  demo: { mesh: () => G.genBox(2), selection: (m) => sel([], innerTopEdges(m)), mode: "edge" },
  related: ["connect", "deledges"],
};

const DELETE_EDGES: CatalogTool = {
  id: "deledges",
  name: "Delete edges",
  category: "edges",
  need: "edges",
  synonyms: ["delete edges", "delete edge", "remove edge", "erase edge", "hole"],
  summary: "Deletes the selected edges together with the faces that touch them.",
  steps: ["Select edges.", "Press Delete."],
  run: (c) => {
    deleteEdges(meshOf(c), selEdges(c));
    c.setSelection(emptySelection());
  },
  demo: { mesh: () => G.genBox(2), selection: (m) => sel([], [verticalEdge(m)]), mode: "edge" },
  related: ["dissolve"],
};

const BEVEL: CatalogTool = {
  id: "bevel",
  name: "Bevel",
  category: "edges",
  key: "B",
  need: "edges",
  pie: true,
  synonyms: ["bevel", "chamfer", "fillet", "round off edge", "rounded corner", "soften edge", "cut corner"],
  summary: "Cuts off the selected edges. With several segments it turns them into a smooth rounding.",
  steps: [
    "Select edges (double-click selects a loop).",
    "Press B and move the mouse away to widen the bevel.",
    "The wheel adds segments, which rounds it. Click to confirm.",
  ],
  params: [
    { key: "w", label: "Width", min: 0.001, max: 50, step: 0.005, def: 0.05, decimals: 3, unit: "m" },
    intParam("seg", "Segments", 1, 16, 1),
  ],
  live: { param: "w", mode: "screen", wheel: "seg" },
  run: (c, p) => {
    const s = bevel(meshOf(c), selEdges(c), p.w, p.seg, sizeOf(c));
    if (!s.faces.size) throw new Error("Only edges between two faces can be bevelled");
    c.setMode("face");
    c.setSelection(s);
  },
  demo: { mesh: () => G.genBox(1), selection: (m) => sel([], topLoop(m)), mode: "edge", params: { w: 0.12, seg: 3 } },
  related: ["loopcut", "subdivide"],
};

const KNIFE: CatalogTool = {
  id: "knife",
  name: "Knife",
  category: "edges",
  key: "K",
  need: "mesh",
  pie: true,
  synonyms: ["knife", "cut", "freehand cut", "slice", "new edge", "split face", "knife project"],
  summary: "Draw a cut by clicking edges or vertices one after another. Each click on an edge adds a new point there.",
  steps: [
    "Enter mesh editing and press K.",
    "Click edges or vertices in order; an edge appears between consecutive points on the same face.",
    "Enter finishes, Esc cancels the whole cut.",
  ],
  live: { pick: "knife" },
  run: () => "Knife: click edges in the view",
  demo: { mesh: () => G.genBox(1), mode: "edge" },
  demoRun: (c) => {
    const m = meshOf(c);
    const top = [...topologyOf(m).edges].filter(([, e]) => m.v[e.a][2] > 0.4 && m.v[e.b][2] > 0.4).map(([k]) => k);
    const a = insertVertexOnEdge(m, top[0], 0.4);
    const b = insertVertexOnEdge(m, top[2], 0.6);
    c.setSelection(connectVerts(m, new Set([a, b])));
  },
  related: ["connect", "loopcut", "bisect"],
};

export const edgeTools = (): CatalogTool[] => [LOOP_CUT, DISSOLVE, DELETE_EDGES];

export const bevelTools = (): CatalogTool[] => [BEVEL, KNIFE];
