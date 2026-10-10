/** Whole-mesh operations that build or reduce a lot at once: solidify, spin, arrays, decimate, clean up. */
import { decimate } from "@/lib/mesh/decimate";
import * as G from "@/lib/mesh/generators";
import { limitedDissolve } from "@/lib/mesh/limited-dissolve";
import type { Mesh } from "@/lib/mesh/mesh";
import { arrayLinear, arrayRadial } from "@/lib/mesh/ops/array";
import { weld } from "@/lib/mesh/ops/merge";
import { solidify } from "@/lib/mesh/ops/solidify";
import { spin } from "@/lib/mesh/ops/spin";
import { emptySelection } from "@/lib/mesh/selection";
import { fixTJunctions } from "@/lib/mesh/t-junctions";
import type { Vec3 } from "@/lib/vec";
import type { CatalogTool } from "./app";
import { AXIS_PARAM, intParam, meshExtent, meshOf, sel, sizeOf, unitAxis, worldAxis } from "./helpers";
import { MAX_FACES } from "./mesh";
import { openBox } from "./select";

/** clean-up welds and stitches points closer than this (unit space) */
const CLEANUP_EPS = 1e-5;

const tooMany = (m: Mesh, copies: number) => {
  if (m.f.length * copies > MAX_FACES) throw new Error("Too many copies");
};

const PROFILE: () => Mesh = () => ({
  v: [
    [0.2, 0, -0.45],
    [0.42, 0, -0.45],
    [0.3, 0, 0],
    [0.45, 0, 0.45],
    [0.2, 0, 0.45],
  ],
  f: [[0, 1, 2, 3, 4]],
  fm: [0],
});

function offCentreBox(): Mesh {
  const m = G.genBox(1);
  for (const v of m.v) {
    v[0] = v[0] * 0.4 + 1;
    v[1] *= 0.4;
  }
  return m;
}

const SOLIDIFY: CatalogTool = {
  id: "solidify",
  name: "Solidify",
  category: "mesh",
  need: "mesh",
  synonyms: ["solidify", "thickness", "make thicker", "shell", "wall", "hollow", "hollow out", "sheet metal"],
  summary:
    "Turns a flat surface into a solid of the given thickness. A closed solid gets hollowed out, leaving a wall.",
  steps: [
    "Select an object (e.g. a sheet or an open shape).",
    "Move the mouse to set the thickness; positive goes inward.",
  ],
  params: [{ key: "th", label: "Thickness", min: -5, max: 5, step: 0.005, def: 0.05, decimals: 3, unit: "m" }],
  live: { param: "th", mode: "screen" },
  run: (c, p) => {
    if (Math.abs(p.th) < 1e-6) return "Thickness 0: no change";
    const s = solidify(meshOf(c), p.th, sizeOf(c));
    c.setMode("face");
    c.setSelection(s);
  },
  demo: { mesh: openBox, params: { th: 0.08 } },
  related: ["extrude", "check"],
};

const SPIN: CatalogTool = {
  id: "spin",
  name: "Spin (lathe)",
  category: "mesh",
  need: "facesOrEdges",
  synonyms: ["spin", "lathe", "revolve", "screw", "rotate profile", "vase", "goblet", "bottle"],
  summary: "Spins the selected profile around an axis and builds a solid of revolution: vases, columns, goblets.",
  steps: [
    "Draw a profile: a plane with moved points or a few faces beside the axis.",
    "Select the profile faces (or the edges on its border).",
    "Move the mouse to set the angle, the wheel sets the number of segments. The axis passes through the object pivot.",
  ],
  params: [
    { key: "ang", label: "Angle", min: 1, max: 360, step: 1, def: 360, decimals: 0, unit: "°" },
    intParam("steps", "Segments", 1, 128, 24),
    AXIS_PARAM,
  ],
  live: { param: "ang", mode: "screen", wheel: "steps" },
  run: (c, p) => {
    const sweep = { axis: { p: [0, 0, 0] as Vec3, d: unitAxis(p.axis) }, angleDeg: p.ang, steps: p.steps };
    const s = spin(meshOf(c), new Set(c.selection.faces), new Set(c.selection.edges), sweep, sizeOf(c));
    c.setMode("object");
    c.setSelection(s);
  },
  demo: { mesh: PROFILE, selection: () => sel([0]), mode: "face", params: { ang: 300, steps: 20, axis: 2 } },
  related: ["extrude", "circle"],
};

const ARRAY: CatalogTool = {
  id: "array",
  name: "Array",
  category: "mesh",
  need: "mesh",
  synonyms: ["array", "linear array", "repeat", "copies in a row", "duplicate in a row", "fence", "pattern"],
  summary: "Lines up copies of the mesh in a row. Copies that touch merge into one solid.",
  steps: [
    "Select an object.",
    "The wheel sets the number of copies, the mouse sets the gap between them (0 = touching).",
  ],
  params: [
    intParam("n", "Copies", 1, 200, 3),
    { key: "gap", label: "Gap", min: -50, max: 50, step: 0.01, def: 0, decimals: 3, unit: "m" },
    { ...AXIS_PARAM, def: 0 },
  ],
  live: { param: "gap", mode: "axis", wheel: "n", axis: (c, p) => worldAxis(c, p.axis ?? 0) },
  run: (c, p) => {
    const m = meshOf(c);
    const offset: Vec3 = [0, 0, 0];
    offset[p.axis] = meshExtent(m, sizeOf(c))[p.axis] + p.gap;
    tooMany(m, p.n);
    c.setSelection(arrayLinear(m, p.n, offset, sizeOf(c)));
  },
  demo: { mesh: () => G.genBox(1), params: { n: 4, gap: 0.3, axis: 0 } },
  related: ["arrayr", "duplicate"],
};

const RADIAL_ARRAY: CatalogTool = {
  id: "arrayr",
  name: "Radial array",
  category: "mesh",
  need: "mesh",
  synonyms: ["radial array", "circular array", "around", "in a circle", "polar array", "railing", "posts around"],
  summary: "Places copies of the mesh in a circle around the object pivot.",
  steps: [
    "Move the pivot to where the centre of the circle should be (Set pivot tool), and move the solid away from it.",
    "The wheel sets the number of copies, the mouse sets the angle.",
  ],
  params: [
    intParam("n", "Copies", 1, 200, 6),
    { key: "ang", label: "Angle", min: 1, max: 360, step: 1, def: 360, decimals: 0, unit: "°" },
    AXIS_PARAM,
  ],
  live: { param: "ang", mode: "screen", wheel: "n" },
  run: (c, p) => {
    const m = meshOf(c);
    tooMany(m, p.n);
    const radial = { count: p.n, axis: { p: [0, 0, 0] as Vec3, d: unitAxis(p.axis) }, angleDeg: p.ang };
    c.setSelection(arrayRadial(m, radial, sizeOf(c)));
  },
  demo: { mesh: offCentreBox, params: { n: 8, ang: 360, axis: 2 } },
  related: ["array", "origin"],
};

const DECIMATE: CatalogTool = {
  id: "decimate",
  name: "Decimate",
  category: "mesh",
  need: "mesh",
  synonyms: [
    ...["decimate", "simplify", "fewer triangles", "lod", "optimize", "reduce polygons", "polygon reduction"],
    "low poly",
  ],
  summary: "Reduces the triangle count while keeping the shape. For LOD levels in games.",
  steps: [
    "Select an object.",
    "Move the mouse to set what percentage of triangles stays.",
    "Check the result with the Check mesh tool.",
  ],
  params: [
    { key: "pct", label: "Keep", min: 1, max: 100, step: 1, def: 50, decimals: 0, unit: "%" },
    { ...intParam("border", "Borders", 0, 1, 1), options: ["may change", "preserve"] },
  ],
  live: { param: "pct", mode: "screen" },
  run: (c, p) => {
    const r = decimate(meshOf(c), p.pct / 100, { keepBoundary: p.border === 1 });
    c.setSelection(emptySelection());
    return `Triangles: ${r.before} → ${r.after}`;
  },
  demo: { mesh: () => G.genSphere(24), params: { pct: 20 } },
  related: ["check", "cleanup"],
};

const CLEANUP: CatalogTool = {
  id: "cleanup",
  name: "Clean up mesh",
  category: "mesh",
  need: "mesh",
  synonyms: [
    ...["cleanup", "limited dissolve", "tidy up", "merge flat faces", "remove extra edges", "repair", "fix"],
    ...["t-junction", "imported mesh"],
  ],
  summary:
    "Merges neighbouring flat faces into one, removes extra points and stitches cracks. Good after import and after Boolean operations.",
  steps: ["Select an object.", "Move the mouse to set the angle below which faces count as flat."],
  params: [{ key: "ang", label: "Angle", min: 0, max: 60, step: 0.5, def: 3, decimals: 1, unit: "°" }],
  live: { param: "ang", mode: "screen" },
  run: (c, p) => {
    const m = meshOf(c);
    const welded = weld(m, CLEANUP_EPS);
    const stitched = fixTJunctions(m, CLEANUP_EPS);
    const merged = limitedDissolve(m, p.ang);
    c.setSelection(emptySelection());
    return `Faces merged: ${merged}${welded ? `, points: ${welded}` : ""}${stitched ? `, stitched: ${stitched}` : ""}`;
  },
  demo: { mesh: () => G.genBox(3), params: { ang: 3 } },
  related: ["weld", "decimate", "quads"],
};

export const modifierTools = (): CatalogTool[] => [SOLIDIFY, SPIN, ARRAY, RADIAL_ARRAY, DECIMATE, CLEANUP];
