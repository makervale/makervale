/** Smarter selection: by angle, by flatness, by likeness. */
import * as G from "@/lib/mesh/generators";
import type { Mesh } from "@/lib/mesh/mesh";
import { inset } from "@/lib/mesh/ops/inset";
import type { SimilarBy } from "@/lib/mesh/select-similar";
import { flatRegion, sharpEdges, similarFaces } from "@/lib/mesh/select-similar";
import { selectedFaces } from "@/lib/mesh/selection";
import type { CatalogTool } from "./app";
import { intParam, meshOf, sel, sizeOf, topFaces } from "./helpers";

const SIMILAR_BY: SimilarBy[] = ["normal", "area", "material"];
/** a direction tolerance of 100 % is 90° */
const DEGREES_PER_PERCENT = 0.9;

function cylinderWithRecess(): Mesh {
  const m = G.genCylinder(16);
  inset(m, new Set(topFaces(m)), 0.3, -0.2);
  return m;
}

const SHARP: CatalogTool = {
  id: "selsharp",
  name: "Select sharp edges",
  category: "select",
  kind: "select",
  need: "mesh",
  synonyms: ["sharp", "select sharp", "hard edges", "corners", "edges to bevel", "by angle"],
  summary: "Selects edges where faces bend more sharply than the given angle. A good start before bevelling.",
  steps: ["Select an object.", "Set the angle; you can bevel the result right away (B)."],
  params: [{ ...intParam("ang", "Angle", 1, 179, 30), unit: "°" }],
  run: (c, p) => {
    const s = sel([], [...sharpEdges(meshOf(c), p.ang, sizeOf(c))]);
    c.setMode("edge");
    c.setSelection(s);
    return s.edges.size ? `Edges selected: ${s.edges.size}` : "No edges that sharp";
  },
  demo: { mesh: cylinderWithRecess, mode: "edge", params: { ang: 30 } },
  related: ["bevel", "selflat"],
};

const FLAT: CatalogTool = {
  id: "selflat",
  name: "Select flat area",
  category: "select",
  kind: "select",
  need: "faces",
  synonyms: ["flat", "coplanar", "select coplanar", "linked flat faces", "same plane", "whole wall", "grow over flat"],
  summary: "Grows the selection to neighbouring faces lying in the same plane (up to the given angle).",
  steps: ["Select one face.", "Choose this card; the angle says how far faces may deviate."],
  params: [{ ...intParam("ang", "Angle", 0, 90, 5), unit: "°" }],
  run: (c, p) => {
    const m = meshOf(c);
    c.setMode("face");
    c.setSelection(sel([...flatRegion(m, selectedFaces(m, c.selection), p.ang, sizeOf(c))]));
  },
  demo: { mesh: () => G.genBox(3), selection: (m) => sel([topFaces(m)[4]]), mode: "face" },
  related: ["selsimilar", "grow"],
};

const SIMILAR: CatalogTool = {
  id: "selsimilar",
  name: "Select similar",
  category: "select",
  kind: "select",
  need: "faces",
  synonyms: ["similar", "select similar", "same", "same direction", "same size", "all top faces", "matching"],
  summary: "Selects all faces similar to the selected ones: same direction, size or material.",
  steps: ["Select a sample face.", "Choose what should be similar."],
  params: [
    { ...intParam("by", "Similar by", 0, 2, 0), options: ["direction", "size", "material"] },
    { ...intParam("tol", "Tolerance", 1, 100, 10), unit: "%" },
  ],
  run: (c, p) => {
    const m = meshOf(c);
    const by = SIMILAR_BY[p.by];
    const tol = by === "normal" ? p.tol * DEGREES_PER_PERCENT : p.tol / 100;
    c.setMode("face");
    c.setSelection(sel([...similarFaces(m, selectedFaces(m, c.selection), by, tol, sizeOf(c))]));
  },
  demo: { mesh: () => G.genStairs(4), selection: (m) => sel([topFaces(m)[0]]), mode: "face" },
  related: ["selflat", "bymat"],
};

export const smartSelectTools = (): CatalogTool[] => [SHARP, FLAT, SIMILAR];
