/** Whole mesh: subdivide, mirror, merge by distance. */
import * as G from "@/lib/mesh/generators";
import type { Mesh } from "@/lib/mesh/mesh";
import { deleteFaces } from "@/lib/mesh/ops/delete";
import { weld } from "@/lib/mesh/ops/merge";
import { mirrorX } from "@/lib/mesh/ops/mirror";
import { recalcNormals } from "@/lib/mesh/ops/normals";
import { subdivide } from "@/lib/mesh/ops/subdivide";
import { emptySelection } from "@/lib/mesh/selection";
import type { Vec3 } from "@/lib/vec";
import type { CatalogTool } from "./app";
import { AXIS_PARAM, intParam, meshOf, objOf } from "./helpers";

/** more faces than this make the editor sluggish */
export const MAX_FACES = 200000;
/** points of a mirrored half this close to the mirror plane are put on it, so the seam welds */
const ON_SEAM = 1e-3;
const SEAM_WELD = 1e-5;

/** keep the `keep` side (+1 or −1) of the X axis and build its mirror image */
function mirrorAboutX(m: Mesh, keep: number): void {
  const flipX = () => m.v.forEach((v) => (v[0] = -v[0]));
  if (keep < 0) flipX();
  const drop = new Set<number>();
  m.f.forEach((f, i) => {
    const cx = f.reduce((a, v) => a + m.v[v][0], 0) / f.length;
    if (cx < -1e-6) drop.add(i);
  });
  if (drop.size) deleteFaces(m, drop);
  for (const v of m.v) if (Math.abs(v[0]) < ON_SEAM) v[0] = 0;
  mirrorX(m);
  weld(m, SEAM_WELD);
  if (keep < 0) flipX();
}

/** mirror about any axis by swapping it with X around the X-only mirror */
function mirrorMesh(m: Mesh, axis: number, keep: number): void {
  const swap = (v: Vec3) => {
    const t = v[0];
    v[0] = v[axis];
    v[axis] = t;
  };
  if (axis) m.v.forEach(swap);
  mirrorAboutX(m, keep);
  if (axis) m.v.forEach(swap);
  recalcNormals(m);
}

/** a box whose every face has its own corners */
function looseBox(): Mesh {
  const b = G.genBox(1);
  const m: Mesh = { v: [], f: [], fm: [] };
  b.f.forEach((p, i) => {
    m.f.push(p.map((vi) => m.v.push([...b.v[vi]]) - 1));
    m.fm.push(b.fm[i]);
  });
  return m;
}

function lopsidedBox(): Mesh {
  const m = G.genBox(2);
  for (const v of m.v) {
    if (v[0] <= 0.01) continue;
    v[2] *= 1.6;
    v[1] *= 0.6;
  }
  return m;
}

const MESH_TOOLS: CatalogTool[] = [
  {
    id: "subdivide",
    name: "Subdivide",
    category: "mesh",
    need: "mesh",
    synonyms: [
      ...["subdivide", "subdivision surface", "subsurf", "catmull-clark", "turbosmooth", "meshsmooth"],
      ...["smooth", "round off", "more faces"],
    ],
    summary:
      "Splits every face into quads and rounds the shape (Catmull-Clark). Turns a simple cage into a smooth shape.",
    steps: [
      "Build a simple shape out of quads.",
      "Pick Subdivide; level 2 is usually enough.",
      "To keep edges sharp, add loops close to them.",
    ],
    params: [intParam("lvl", "Levels", 1, 4, 1)],
    live: { wheel: "lvl" },
    run: (c, p) => {
      const m = meshOf(c);
      for (let i = 0; i < p.lvl; i++) {
        if (m.f.length * 4 > MAX_FACES) throw new Error("Too many faces: lower the level");
        subdivide(m);
      }
      c.setSelection(emptySelection());
    },
    demo: { mesh: () => G.genBox(1), params: { lvl: 2 } },
    related: ["loopcut", "smooth"],
  },
  {
    id: "mirror",
    name: "Mirror",
    category: "mesh",
    need: "mesh",
    synonyms: ["mirror", "symmetry", "symmetrize", "reflect", "flip copy", "build other half"],
    summary: "Keeps one half of the model and builds its mirror image. Model one half, the mirror does the rest.",
    steps: [
      "Build half the model on one side of the axis.",
      "Pick the axis and the side to keep.",
      "The seam on the axis gets welded.",
    ],
    params: [
      { ...AXIS_PARAM, def: 0 },
      { ...intParam("keep", "Keep side", 0, 1, 0), options: ["positive (+)", "negative (−)"] },
    ],
    run: (c, p) => {
      mirrorMesh(meshOf(c), p.axis, p.keep ? -1 : 1);
      c.setSelection(emptySelection());
    },
    demo: { mesh: lopsidedBox },
    related: ["opt-mirror"],
  },
  {
    id: "weld",
    name: "Merge by distance",
    category: "mesh",
    need: "mesh",
    synonyms: ["weld", "merge by distance", "remove doubles", "duplicates", "double vertices", "stitch", "close seams"],
    summary: "Joins points closer than the given distance. Removes duplicates after joining parts.",
    steps: ["Select an object.", "Set the distance."],
    params: [{ key: "d", label: "Distance", min: 0.0001, max: 1, step: 0.001, def: 0.001, decimals: 4, unit: "m" }],
    live: { param: "d", mode: "screen" },
    run: (c, p) => {
      const s = objOf(c).size;
      const n = weld(meshOf(c), p.d / Math.max(1e-6, (s[0] + s[1] + s[2]) / 3));
      c.setSelection(emptySelection());
      return n ? `Merged ${n} points` : "Nothing to merge";
    },
    demo: { mesh: looseBox },
    related: ["merge", "join"],
  },
];

export const meshTools = (): CatalogTool[] => MESH_TOOLS;
