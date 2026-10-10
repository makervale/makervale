/** Faces: extruding, insetting, filling, deleting and tidying up faces. */
import type { ToolContext } from "@/app/tools";
import * as G from "@/lib/mesh/generators";
import { faceNormal } from "@/lib/mesh/mesh";
import { deleteFaces } from "@/lib/mesh/ops/delete";
import { extrude, regionNormal } from "@/lib/mesh/ops/extrude";
import { fill } from "@/lib/mesh/ops/fill";
import { inset } from "@/lib/mesh/ops/inset";
import { flip, recalcNormals } from "@/lib/mesh/ops/normals";
import { triangulate } from "@/lib/mesh/ops/triangulate";
import { trisToQuads } from "@/lib/mesh/ops/tris-to-quads";
import { emptySelection, selectedFaces, selectedVerts } from "@/lib/mesh/selection";
import type { CatalogTool, ToolApp } from "./app";
import { allFaces, meshOf, moveVerts, sel, topFaces, topVerts } from "./helpers";
import { openBox } from "./select";

const selFaces = (c: ToolContext) => selectedFaces(meshOf(c), c.selection);
const box1 = () => G.genBox(1);
const box2 = () => G.genBox(2);
const topOf = { selection: (m: Parameters<typeof topFaces>[0]) => sel(topFaces(m)), mode: "face" as const };

function extrudeTool(app: ToolApp): CatalogTool {
  return {
    id: "extrude",
    name: "Extrude",
    category: "faces",
    key: "E",
    need: "faces",
    pie: true,
    icon: "extrude",
    synonyms: ["extrude", "push pull", "pull out", "extend", "emboss", "build out", "arm", "leg"],
    summary: "Pulls the selected faces outward and builds the sides. The basic way to add to a shape.",
    steps: [
      "Select faces (Faces mode, key 5).",
      "Press E.",
      "Set the distance in the last-operation panel or drag the blue arrow.",
    ],
    params: [{ key: "d", label: "Distance", min: -50, max: 50, step: 0.05, def: 0.25, decimals: 3, unit: "m" }],
    live: { param: "d", mode: "axis" },
    run: (c, p) => {
      const m = meshOf(c);
      const faces = selFaces(c);
      const n = regionNormal(m, faces);
      const s = extrude(m, faces);
      moveVerts(
        m,
        [...faces].flatMap((f) => m.f[f]),
        c.localOffset(n, p.d),
      );
      c.setMode("face");
      c.setSelection(s);
      // after an extrude the arrows should follow the new faces
      if (!c.demo && app.store.settings.axes === "world") app.commands.setSettings({ axes: "normal" });
    },
    demo: { mesh: box1, ...topOf, params: { d: 0.4 } },
    related: ["inset", "loopcut"],
  };
}

const FACE_TOOLS: CatalogTool[] = [
  {
    id: "inset",
    name: "Inset",
    category: "faces",
    key: "I",
    need: "faces",
    pie: true,
    synonyms: ["inset", "make a hole", "hole", "recess", "indent", "frame", "window", "panel"],
    summary: "Shrinks each face and surrounds it with a frame. With depth it makes a recess or a bump right away.",
    steps: ["Select faces.", "Press I.", "Set the frame thickness; negative depth makes a recess."],
    params: [
      { key: "t", label: "Frame thickness", min: 1, max: 95, step: 1, def: 25, decimals: 0, unit: "%" },
      { key: "depth", label: "Depth", min: -20, max: 20, step: 0.01, def: 0, decimals: 3, unit: "m" },
    ],
    live: { param: "t", mode: "screen" },
    run: (c, p) => {
      const m = meshOf(c);
      const faces = selFaces(c);
      const s = inset(m, faces, p.t / 100, 0);
      if (p.depth) for (const f of faces) moveVerts(m, m.f[f], c.localOffset(faceNormal(m, m.f[f]), p.depth));
      c.setMode("face");
      c.setSelection(s);
    },
    demo: { mesh: box1, ...topOf, params: { depth: -0.15 } },
    related: ["extrude", "circle"],
  },
  {
    id: "delfaces",
    name: "Delete faces",
    category: "faces",
    key: "Del",
    need: "faces",
    pie: true,
    synonyms: ["delete faces", "delete", "remove", "erase", "hole", "open up"],
    summary: "Deletes the selected faces. A hole is left, which you can close with Fill.",
    steps: ["Select faces.", "Press Delete."],
    run: (c) => {
      deleteFaces(meshOf(c), selFaces(c));
      c.setSelection(emptySelection());
    },
    demo: { mesh: box2, selection: (m) => sel(topFaces(m).slice(0, 2)), mode: "face" },
    related: ["fill", "boundary"],
  },
  {
    id: "fill",
    name: "Fill",
    category: "faces",
    need: "verts3",
    synonyms: ["fill", "make face", "close hole", "cap", "patch", "fill hole", "face from points"],
    summary: "Makes one face through the selected points. Closes holes and adds missing faces.",
    steps: ["Select the border edges of the hole (the Open edges card helps).", "Pick Fill."],
    run: (c) => {
      const m = meshOf(c);
      const r = fill(m, selectedVerts(m, c.selection), 0);
      if (r === false) throw new Error("The points lie in a straight line");
      c.setMode("face");
      c.setSelection(sel([r]));
    },
    demo: { mesh: openBox, selection: (m) => sel([], [], topVerts(m)), mode: "vert" },
    related: ["boundary", "delfaces"],
  },
];

const NORMAL_TOOLS: CatalogTool[] = [
  {
    id: "flip",
    name: "Flip normals",
    category: "faces",
    need: "faces",
    synonyms: ["flip normals", "flip", "reverse", "inside out", "black faces", "invisible faces", "see-through faces"],
    summary: "Flips the side the selected faces point to. Fixes faces that look see-through from outside.",
    steps: ["Select the wrongly facing faces.", "Pick Flip normals."],
    run: (c) => flip(meshOf(c), selFaces(c)),
    demo: { mesh: box1, ...topOf },
    related: ["recalc"],
  },
  {
    id: "recalc",
    name: "Recalculate normals",
    category: "faces",
    need: "mesh",
    synonyms: ["recalculate normals", "normals", "fix normals", "consistent", "outside", "unify normals"],
    summary: "Makes all faces consistent and pointing outward. Needed before 3D printing and exporting to games.",
    steps: ["Select an object.", "Pick Recalculate normals."],
    run: (c) => {
      const n = recalcNormals(meshOf(c));
      return n ? `Fixed ${n} faces` : "The normals were fine";
    },
    demo: {
      mesh: () => {
        const m = G.genSphere(12);
        flip(m, new Set([3, 8, 20, 40]));
        return m;
      },
    },
    related: ["flip", "check"],
  },
  {
    id: "triangulate",
    name: "Triangulate",
    category: "faces",
    need: "faces",
    synonyms: ["triangulate", "triangles", "tris", "quads to tris", "split into triangles"],
    summary:
      "Splits the selected faces into triangles. Game engines do this anyway, but sometimes you want to choose the split yourself.",
    steps: ["Select faces.", "Pick Triangulate."],
    run: (c) => {
      c.setSelection(triangulate(meshOf(c), selFaces(c)));
    },
    demo: { mesh: box2, ...topOf },
    related: ["quads"],
  },
  {
    id: "quads",
    name: "Triangles to quads",
    category: "faces",
    need: "faces",
    synonyms: ["quads", "tris to quads", "triangles to quads", "join triangles", "quadrangulate"],
    summary: "Joins pairs of neighbouring triangles into quads when they lie almost in one plane.",
    steps: ["Select triangles.", "Set the allowed angle."],
    params: [{ key: "ang", label: "Max. angle", min: 0, max: 60, step: 1, def: 10, decimals: 0, unit: "°" }],
    live: { param: "ang", mode: "screen" },
    run: (c, p) => {
      c.setSelection(trisToQuads(meshOf(c), selFaces(c), p.ang));
    },
    demo: {
      mesh: () => {
        const m = G.genBox(2);
        triangulate(m, new Set(allFaces(m)));
        return m;
      },
      selection: (m) => sel(allFaces(m)),
      mode: "face",
    },
    related: ["triangulate"],
  },
];

export const faceTools = (app: ToolApp): CatalogTool[] => [extrudeTool(app), ...FACE_TOOLS];

export const normalTools = (): CatalogTool[] => NORMAL_TOOLS;
