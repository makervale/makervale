/** Select: ways to select many elements at once. */
import type { ToolContext } from "@/app/tools";
import { selectAll, selectTool } from "./select-card";
import type { SelectCard } from "./select-card";
import { edgeLoop, edgeRing } from "@/lib/mesh/edge-loops";
import * as G from "@/lib/mesh/generators";
import type { Mesh } from "@/lib/mesh/mesh";
import { append } from "@/lib/mesh/ops/append";
import { deleteFaces } from "@/lib/mesh/ops/delete";
import { boundaryEdges, facesByMaterial, grow, invertSelection, linked, shrink } from "@/lib/mesh/select-grow";
import type { ElementSelection } from "@/lib/mesh/selection";
import { emptySelection, selectedEdges } from "@/lib/mesh/selection";
import { topologyOf } from "@/lib/mesh/topology";
import type { CatalogTool } from "./app";
import { intParam, meshOf, sel, topFaces, verticalEdge } from "./helpers";

/** every edge of the loops (or rings) through the selected edges */
function edgesThrough(c: ToolContext, walk: (m: Mesh, k: string) => Set<string>): ElementSelection {
  const m = meshOf(c);
  const out = emptySelection();
  for (const k of selectedEdges(m, c.selection)) for (const e of walk(m, k)) out.edges.add(e);
  c.setMode("edge");
  return out;
}

function twoBoxes(): Mesh {
  const m = G.genBox(1);
  for (const v of m.v) v[0] = v[0] * 0.4 - 0.25;
  const b = G.genBox(1);
  for (const v of b.v) v[0] = v[0] * 0.4 + 0.25;
  append(m, b);
  return m;
}

/** a horizontal edge on the lower ring of a three-ring cylinder */
function lowRingEdge(m: Mesh): string {
  const hit = [...topologyOf(m).edges.entries()].find(
    ([, e]) => Math.abs(m.v[e.a][2] - m.v[e.b][2]) < 1e-6 && Math.abs(m.v[e.a][2] + 1 / 6) < 1e-3,
  );
  return hit ? hit[0] : verticalEdge(m);
}

export function openBox(): Mesh {
  const m = G.genBox(1);
  deleteFaces(m, new Set(topFaces(m)));
  return m;
}

const box2 = () => G.genBox(2);

const CARDS: SelectCard[] = [
  {
    id: "selall",
    name: "Select all",
    key: "Ctrl+A",
    need: "none",
    synonyms: ["select all", "all", "everything", "whole", "select everything"],
    summary: "Selects all objects, or in mesh editing all elements of the current kind.",
    steps: ["Press Ctrl+A.", "In mesh editing it selects all vertices, edges or faces, depending on the mode."],
    pick: selectAll,
    demo: { mesh: box2, mode: "face" },
  },
  {
    id: "invert",
    name: "Invert selection",
    key: "Ctrl+I",
    need: "mesh",
    synonyms: ["invert", "inverse", "select rest", "the rest", "others", "opposite"],
    summary: "Selects what was not selected and deselects the rest.",
    steps: ["Select the elements you don't want.", "Invert the selection to get everything else."],
    pick: (c) => invertSelection(meshOf(c), c.selection, c.mode),
    demo: { mesh: box2, selection: (m) => sel(topFaces(m)), mode: "face" },
    extra: { related: ["grow", "linked"] },
  },
  {
    id: "grow",
    name: "Grow selection",
    key: "+",
    need: "elems",
    synonyms: ["grow", "expand", "more", "select more", "neighbours", "neighbors"],
    summary: "Adds the neighbours of the selected elements. Repeat to keep growing.",
    steps: ["Select an element.", "Press + a few times."],
    pick: (c) => grow(meshOf(c), c.selection),
    demo: { mesh: () => G.genBox(4), selection: (m) => sel([topFaces(m)[5]]), mode: "face" },
    extra: { related: ["shrink", "linked"] },
  },
  {
    id: "shrink",
    name: "Shrink selection",
    key: "−",
    need: "elems",
    synonyms: ["shrink", "less", "select less", "contract", "reduce"],
    summary: "Removes elements from the edge of the selection.",
    steps: ["Select an area.", "Press − to take away its border."],
    pick: (c) => shrink(meshOf(c), c.selection),
    demo: { mesh: () => G.genBox(4), selection: (m) => sel(topFaces(m)), mode: "face" },
    extra: { related: ["grow"] },
  },
  {
    id: "linked",
    name: "Select linked",
    key: "L",
    need: "elems",
    synonyms: ["linked", "connected", "select linked", "whole part", "island", "piece"],
    summary: "Extends the selection to the whole connected part of the mesh.",
    steps: ["Select one element of the part.", "Press L."],
    pick: (c) => linked(meshOf(c), c.selection),
    demo: { mesh: twoBoxes, selection: () => sel([0]), mode: "face" },
  },
  {
    id: "loop",
    name: "Edge loop",
    key: "double-click",
    need: "edges",
    synonyms: ["loop", "edge loop", "select loop", "row", "around", "circumference"],
    summary: "Selects a whole row of edges running through quads, e.g. around a cylinder.",
    steps: ["In Edges mode, double-click an edge.", "Or select an edge and pick this card."],
    pick: (c) => edgesThrough(c, edgeLoop),
    demo: { mesh: () => G.genCylinder(12, 3), selection: (m) => sel([], [lowRingEdge(m)]), mode: "edge" },
    extra: { related: ["ring", "loopcut"], pie: true },
  },
  {
    id: "ring",
    name: "Edge ring",
    key: "Shift+double-click",
    need: "edges",
    synonyms: ["ring", "edge ring", "select ring", "rungs", "ladder", "parallel edges"],
    summary: "Selects edges parallel to the selected one, going across quads. Handy before a loop cut.",
    steps: ["Select an edge.", "Shift+double-click or this card."],
    pick: (c) => edgesThrough(c, edgeRing),
    demo: { mesh: () => G.genCylinder(12, 1), selection: (m) => sel([], [verticalEdge(m)]), mode: "edge" },
    extra: { related: ["loop", "loopcut"] },
  },
  {
    id: "boundary",
    name: "Open edges",
    need: "mesh",
    synonyms: ["boundary", "open edges", "border", "non-manifold", "leak", "gap", "find gaps"],
    summary: "Selects edges that belong to only one face: the borders of holes and open patches.",
    steps: ["Select an object.", "Pick this card: the selected edges show where the mesh is open."],
    pick: (c) => {
      const s = sel([], [...boundaryEdges(meshOf(c))]);
      c.setMode("edge");
      return s.edges.size ? s : "The mesh is closed: no open edges";
    },
    demo: { mesh: openBox, mode: "edge" },
    extra: { related: ["fill", "check"] },
  },
  {
    id: "bymat",
    name: "Select by material",
    need: "mesh",
    synonyms: ["material", "colour", "color", "select by material", "material slot"],
    summary: "Selects all faces that use the chosen material.",
    steps: ["Select an object.", "Set the material number."],
    pick: (c, p) => {
      c.setMode("face");
      return sel([...facesByMaterial(meshOf(c), p.slot - 1)]);
    },
    demo: {
      mesh: () => {
        const m = G.genBox(2);
        topFaces(m).forEach((f) => (m.fm[f] = 1));
        return m;
      },
    },
    extra: { params: [intParam("slot", "Material no.", 1, 64, 1)] },
  },
];

export const BOX_SELECT: CatalogTool = {
  id: "boxsel",
  name: "Box select",
  category: "select",
  kind: "mode",
  need: "none",
  synonyms: ["box select", "marquee", "rectangle", "drag select", "area", "many at once"],
  summary: "Drag over an empty spot to select everything inside the rectangle.",
  steps: [
    "Start dragging outside the object.",
    "Shift adds to the selection.",
    "Works on objects and on mesh elements.",
  ],
  run: () => "Drag a box over an empty spot in the view",
};

export const selectTools = (): CatalogTool[] => [...CARDS.map(selectTool), BOX_SELECT];
