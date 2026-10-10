/** Plane cut: a flat plane through the selection (or the object's middle) along a world axis. */
import type { Params, ToolContext } from "@/app/tools";
import { composeMatrix, invertAffine, transformPoint } from "@/lib/mesh/affine";
import type { Mat4 } from "@/lib/mesh/affine";
import { boundsOf } from "@/lib/mesh/bounds";
import * as G from "@/lib/mesh/generators";
import { bisect } from "@/lib/mesh/ops/bisect";
import type { BisectOptions } from "@/lib/mesh/ops/bisect";
import { centroid } from "@/lib/mesh/points";
import { selectedVerts, selectionCount } from "@/lib/mesh/selection";
import type { Vec3 } from "@/lib/vec";
import { add, lerp, normalize, scale } from "@/lib/vec";
import type { CatalogTool } from "./app";
import { AXIS_PARAM, intParam, meshExtent, meshOf, objOf, unitAxis } from "./helpers";

interface CutPlane {
  /** point and normal in world space */
  pw: Vec3;
  nw: Vec3;
  /** point and normal in the object's unit space */
  pl: Vec3;
  nl: Vec3;
  /** how big to draw it */
  r: number;
}

const REMOVE: BisectOptions["remove"][] = ["none", "front", "back"];

/** a world normal in object space: the transpose of the linear part */
const normalToLocal = (e: Mat4, n: Vec3): Vec3 =>
  normalize([0, 1, 2].map((i) => e[4 * i] * n[0] + e[4 * i + 1] * n[1] + e[4 * i + 2] * n[2]) as Vec3);

/** the centre of the selection, or of the whole object when nothing is selected (world space) */
function planeCentre(c: ToolContext, toWorld: Mat4): Vec3 {
  const o = objOf(c);
  if (selectionCount(c.selection)) return transformPoint(toWorld, centroid(o.mesh, selectedVerts(o.mesh, c.selection)));
  const b = boundsOf(o.mesh.v.map((v) => transformPoint(toWorld, v)));
  return [0, 1, 2].map((k) => lerp(b.lo[k], b.hi[k], 0.5)) as Vec3;
}

function planeOf(c: ToolContext, p: Params): CutPlane {
  const o = objOf(c);
  const toWorld = composeMatrix(o.pos, o.quat, o.size);
  const nw = unitAxis(p.axis);
  const centre = planeCentre(c, toWorld);
  const pw = add(centre, scale(nw, p.off));
  const ext = meshExtent(o.mesh, o.size);
  return {
    pw,
    nw,
    pl: transformPoint(invertAffine(toWorld), pw),
    nl: normalToLocal(toWorld, nw),
    r: Math.max(...ext) * 0.7 + 0.05,
  };
}

export const PLANE_CUT: CatalogTool = {
  id: "bisect",
  name: "Plane cut",
  category: "mesh",
  need: "mesh",
  synonyms: ["bisect", "plane cut", "cut in half", "section", "slice", "cut off", "half"],
  summary: "Cuts the mesh with a flat plane. Keep both parts, or cut one off and close the section.",
  steps: [
    "Select an object (or just some faces).",
    "Choose the plane axis; moving the mouse slides it along the axis.",
    "In the last-operation panel, choose what to do with the cut-off side.",
  ],
  params: [
    AXIS_PARAM,
    { key: "off", label: "Position", min: -500, max: 500, step: 0.01, def: 0, decimals: 3, unit: "m" },
    { ...intParam("side", "Side", 0, 2, 0), options: ["keep both", "delete front (+)", "delete back (−)"] },
    { ...intParam("fill", "Section", 0, 1, 1), options: ["open", "closed with a face"] },
  ],
  live: {
    param: "off",
    mode: "axis",
    axis: (_c, p) => unitAxis(p.axis ?? 2),
    helper: (c, p) => {
      const pl = planeOf(c, p);
      return { kind: "plane", p: pl.pw, n: pl.nw, r: pl.r };
    },
  },
  run: (c, p) => {
    const m = meshOf(c);
    const pl = planeOf(c, p);
    const faces = c.selection.faces.size ? new Set(c.selection.faces) : null;
    const s = bisect(m, faces, { p: pl.pl, n: pl.nl }, { remove: REMOVE[p.side] ?? "none", fill: p.fill === 1 });
    if (!m.f.length) throw new Error("The cut would delete the whole mesh");
    c.setMode(s.faces.size ? "face" : "edge");
    c.setSelection(s);
  },
  demo: { mesh: () => G.genSphere(16), params: { axis: 2, off: 0.15, side: 1, fill: 1 } },
  related: ["knife", "delfaces", "fill"],
};
