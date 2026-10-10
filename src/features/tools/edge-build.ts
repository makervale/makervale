/** Building new faces from edges: bridging two parts, and growing a sheet out of its border. */
import type { ToolContext } from "@/app/tools";
import * as G from "@/lib/mesh/generators";
import type { Mesh } from "@/lib/mesh/mesh";
import { faceCenter, faceNormal, parseEdgeKey } from "@/lib/mesh/mesh";
import { append } from "@/lib/mesh/ops/append";
import { bridge } from "@/lib/mesh/ops/bridge";
import { extrudeEdges } from "@/lib/mesh/ops/extrude";
import { selectedEdges } from "@/lib/mesh/selection";
import { topologyOf } from "@/lib/mesh/topology";
import type { Vec3 } from "@/lib/vec";
import { add, cross, dot, length, lerp, normalize, quatInverse, rotate, scale, sub } from "@/lib/vec";
import type { CatalogTool } from "./app";
import { allFaces, intParam, meshOf, moveVerts, sel } from "./helpers";

/** the direction pointing away from the face next to a border edge, in object space */
function awayFromFace(m: Mesh, a: number, b: number, face: number): Vec3 {
  const A = m.v[a];
  const B = m.v[b];
  const d = normalize(cross(sub(B, A), faceNormal(m, m.f[face])));
  const middle: Vec3 = [lerp(A[0], B[0], 0.5), lerp(A[1], B[1], 0.5), lerp(A[2], B[2], 0.5)];
  return dot(d, sub(middle, faceCenter(m, m.f[face]))) < 0 ? scale(d, -1) : d;
}

/** average direction pointing away from the faces next to the selected border edges (world space) */
function edgeOutward(c: ToolContext): Vec3 {
  const m = meshOf(c);
  const edges = topologyOf(m).edges;
  let out: Vec3 = [0, 0, 0];
  for (const k of selectedEdges(m, c.selection)) {
    const e = edges.get(k);
    if (e && e.faces.length === 1) out = add(out, awayFromFace(m, e.a, e.b, e.faces[0]));
  }
  if (length(out) ** 2 < 1e-12) out = [0, 0, 1];
  return normalize(c.obj ? rotate(out, c.obj.quat) : out);
}

const worldToLocalDir = (c: ToolContext, d: Vec3): Vec3 => (c.obj ? rotate(d, quatInverse(c.obj.quat)) : d);

function twoBoxesApart(): Mesh {
  const m = G.genBox(1);
  for (const v of m.v) v[0] -= 0.6;
  const b = G.genBox(1);
  for (const v of b.v) v[0] += 0.6;
  append(m, b);
  return m;
}

/** the two faces of twoBoxesApart that look at each other */
function facingFaces(m: Mesh): number[] {
  return allFaces(m).filter((i) => {
    const n = faceNormal(m, m.f[i]);
    const left = m.f[i].every((v) => m.v[v][0] < 0);
    const right = m.f[i].every((v) => m.v[v][0] > 0);
    return (n[0] > 0.9 && left) || (n[0] < -0.9 && right);
  });
}

const BRIDGE: CatalogTool = {
  id: "bridge",
  name: "Bridge",
  category: "edges",
  key: "Shift+B",
  need: "twoParts",
  synonyms: ["bridge", "bridge edge loops", "connect loops", "tunnel", "tube between", "connector", "join two parts"],
  summary: "Connects two holes or two selected faces with a tunnel of faces. Two solids become one.",
  steps: [
    "Select one face on each of two mesh parts (facing each other) or the edges of two holes.",
    "Choose Bridge; the wheel adds cuts in between.",
  ],
  params: [intParam("cuts", "Cuts", 0, 32, 0)],
  live: { wheel: "cuts" },
  run: (c, p) => {
    const s = bridge(meshOf(c), new Set(c.selection.edges), new Set(c.selection.faces), p.cuts);
    c.setMode("face");
    c.setSelection(s);
  },
  demo: { mesh: twoBoxesApart, selection: (m) => sel(facingFaces(m)), mode: "face", params: { cuts: 2 } },
  related: ["join", "fill"],
};

const EXTRUDE_EDGES: CatalogTool = {
  id: "edgeext",
  name: "Extrude edges",
  category: "edges",
  need: "edges",
  synonyms: ["extrude edge", "extend", "face from edge", "extend sheet", "grow edge", "pull edge"],
  summary: "A new face grows from edges on the border of an open mesh. Shift+drag on an edge does the same by hand.",
  steps: ["Select border edges (e.g. of a sheet).", "Move the mouse to set how far the new face reaches."],
  params: [{ key: "d", label: "Distance", min: -50, max: 50, step: 0.01, def: 0.25, decimals: 3, unit: "m" }],
  live: { param: "d", mode: "axis", axis: (c) => edgeOutward(c) },
  run: (c, p) => {
    const m = meshOf(c);
    const dir = edgeOutward(c);
    const s = extrudeEdges(m, selectedEdges(m, c.selection));
    const tips = new Set([...s.edges].flatMap((k) => parseEdgeKey(k)));
    moveVerts(m, tips, c.localOffset(worldToLocalDir(c, dir), p.d));
    c.setMode("edge");
    c.setSelection(s);
  },
  demo: {
    mesh: () => G.genPlane(2),
    selection: (m) =>
      sel(
        [],
        [...topologyOf(m).edges].filter(([, e]) => m.v[e.a][0] > 0.49 && m.v[e.b][0] > 0.49).map(([k]) => k),
      ),
    mode: "edge",
    params: { d: 0.4 },
  },
  related: ["extrude", "fill"],
};

export const edgeBuildTools = (): CatalogTool[] => [BRIDGE, EXTRUDE_EDGES];
