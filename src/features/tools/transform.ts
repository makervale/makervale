/** Transform: the three manipulators, and moving many points at once (flatten, smooth, inflate, to circle). */
import type { ToolContext } from "@/app/tools";
import type { Manipulator } from "@/app/store";
import { composeMatrix, invertAffine, transformPoint } from "@/lib/mesh/affine";
import * as G from "@/lib/mesh/generators";
import type { Mesh } from "@/lib/mesh/mesh";
import { faceNormal } from "@/lib/mesh/mesh";
import { pushAlongNormals, smooth, toCircle } from "@/lib/mesh/ops/shape";
import { selectedVerts } from "@/lib/mesh/selection";
import type { Obj } from "@/world/model";
import { rotate } from "@/lib/vec";
import type { CatalogTool, ToolApp } from "./app";
import { AXIS_PARAM, allFaces, allVerts, intParam, meshOf, moveVerts, objOf, sel, topFaces, topVerts } from "./helpers";

interface ManipCard {
  id: Manipulator;
  name: string;
  key: string;
  synonyms: string[];
  summary: string;
  steps: string[];
  demoRun: (c: ToolContext) => void;
}

function manipulator(app: ToolApp, s: ManipCard): CatalogTool {
  return {
    ...s,
    category: "transform",
    kind: "mode",
    need: "none",
    run: () => app.commands.setToolMode(app.store.toolMode, s.id),
    demo: { mesh: () => G.genBox(2), selection: (m) => sel(topFaces(m).slice(0, 1)), mode: "face" },
    pie: false,
  };
}

const selVerts = (c: ToolContext) => selectedVerts(meshOf(c), c.selection);

const MANIPULATORS: ManipCard[] = [
  {
    id: "move",
    name: "Move",
    key: "default",
    synonyms: ["move", "grab", "translate", "position", "arrows", "drag"],
    summary:
      "Arrows move the selection along an axis. Slide the cursor off the arrow onto the ruler next to it, and the move starts snapping to the ticks.",
    steps: [
      "Select an object or mesh elements.",
      "Drag an arrow or a plane square.",
      "Shift+drag leaves a copy at the starting point.",
    ],
    demoRun: (c) => moveVerts(meshOf(c), selVerts(c), [0, 0, 0.35]),
  },
  {
    id: "rotate",
    name: "Rotate",
    key: "Ctrl",
    synonyms: ["rotate", "turn", "spin", "angle", "rings", "orientation"],
    summary: "Coloured rings rotate around an axis. Off the ring, rotation snaps in steps of 5.625°.",
    steps: ["Hold Ctrl or pick Rotate.", "Drag a ring."],
    demoRun: (c) => {
      const m = meshOf(c);
      for (const i of selVerts(c)) m.v[i] = rotate(m.v[i], [0, 0, Math.sin(0.3), Math.cos(0.3)]);
    },
  },
  {
    id: "scale",
    name: "Stretch",
    key: "Ctrl+Shift",
    synonyms: ["scale", "stretch", "resize", "size", "bigger", "smaller"],
    summary:
      "Coloured handles on the box faces stretch along one axis only, corner handles scale proportionally. Works on objects, groups and selected mesh elements.",
    steps: [
      "Hold Ctrl+Shift or pick Stretch.",
      "Drag a coloured face handle to change one axis, or a corner to scale everything.",
      "In mesh editing the box turns to match the axes choice: World, Local or Normal.",
    ],
    demoRun: (c) => {
      const m = meshOf(c);
      for (const i of selVerts(c)) m.v[i][0] *= 0.45;
    },
  },
];

/** puts the points at the average value of one world axis */
function flattenAlongWorldAxis(o: Obj, ids: Set<number>, axis: number): void {
  const toWorld = composeMatrix(o.pos, o.quat, o.size);
  const toLocal = invertAffine(toWorld);
  const world = [...ids].map((i) => transformPoint(toWorld, o.mesh.v[i]));
  const mean = world.reduce((a, w) => a + w[axis], 0) / world.length;
  [...ids].forEach((i, k) => {
    world[k][axis] = mean;
    o.mesh.v[i] = transformPoint(toLocal, world[k]);
  });
}

function wavyPlane(): Mesh {
  const m = G.genPlane(4);
  m.v.forEach((v, i) => (v[2] = Math.sin(i * 1.7) * 0.15));
  return m;
}

function lumpyBall(): Mesh {
  const m = G.genIcosphere(2);
  m.v.forEach((v, i) => {
    const k = 1 + Math.sin(i * 12.9898) * 0.18;
    v[0] *= k;
    v[1] *= k;
    v[2] *= k;
  });
  return m;
}

/** a cylinder whose top ring was pushed out into a square */
function squaredTop(): Mesh {
  const m = G.genCylinder(16);
  for (const v of m.v) {
    if (v[2] <= 0.49) continue;
    const k = (1 / Math.max(Math.abs(v[0]), Math.abs(v[1]))) * 0.5 * 0.8;
    v[0] *= k;
    v[1] *= k;
  }
  return m;
}

const SHAPING: CatalogTool[] = [
  {
    id: "flatten",
    name: "Flatten",
    category: "transform",
    need: "verts2",
    synonyms: ["flatten", "align", "level", "make flat", "even out", "scale 0", "planar"],
    summary:
      "Puts the selected points in one plane: at the average height, or the average value of the chosen world axis.",
    steps: ["Select the points that should line up.", "Pick an axis."],
    params: [AXIS_PARAM],
    run: (c, p) => {
      flattenAlongWorldAxis(objOf(c), selVerts(c), p.axis);
      return "Flattened along " + "XYZ"[p.axis];
    },
    demo: { mesh: wavyPlane, selection: (m) => sel([], [], allVerts(m)), mode: "vert" },
    related: ["circle", "smooth"],
  },
  {
    id: "smooth",
    name: "Smooth",
    category: "transform",
    need: "mesh",
    synonyms: ["smooth", "relax", "soften", "average", "round off", "even out", "smooth vertices"],
    summary: "Pulls each point toward the average of its neighbours. With nothing selected it smooths the whole mesh.",
    steps: ["Select an area, or nothing.", "Raise the iterations for a stronger effect."],
    params: [
      intParam("iter", "Iterations", 1, 50, 3),
      { key: "k", label: "Strength", min: 0.05, max: 1, step: 0.05, def: 0.5, decimals: 2 },
    ],
    live: { param: "iter", mode: "screen" },
    run: (c, p) => {
      const m = meshOf(c);
      const vs = selVerts(c);
      smooth(m, vs.size ? vs : new Set(allVerts(m)), p.iter, p.k);
    },
    demo: { mesh: lumpyBall },
    related: ["subdivide", "inflate"],
  },
  {
    id: "inflate",
    name: "Inflate",
    category: "transform",
    need: "elems",
    synonyms: ["inflate", "fatten", "shrink fatten", "push", "puff up", "make thicker", "thinner", "along normals"],
    summary: "Moves each point along its own normal: the selection swells or slims down.",
    steps: ["Select elements.", "Set the distance; negative shrinks."],
    params: [{ key: "d", label: "Distance", min: -2, max: 2, step: 0.01, def: 0.05, decimals: 3, unit: "m" }],
    live: { param: "d", mode: "screen" },
    run: (c, p) => {
      const s = objOf(c).size;
      pushAlongNormals(meshOf(c), selVerts(c), p.d / ((s[0] + s[1] + s[2]) / 3));
    },
    demo: {
      mesh: () => G.genSphere(16),
      selection: (m) => sel(allFaces(m).filter((i) => faceNormal(m, m.f[i])[0] > 0.3)),
      mode: "face",
      params: { d: 0.12 },
    },
  },
  {
    id: "circle",
    name: "To circle",
    category: "transform",
    need: "verts3",
    synonyms: ["circle", "to circle", "round", "looptools", "round opening", "make round"],
    summary: "Spreads the selected loop of points evenly on a circle. Turns square holes into round ones.",
    steps: ["Select a closed loop of vertices or edges.", "Pick this card."],
    run: (c) => {
      if (!toCircle(meshOf(c), selVerts(c))) throw new Error("The points lie in a straight line");
    },
    demo: { mesh: squaredTop, selection: (m) => sel([], [], topVerts(m)), mode: "vert" },
    related: ["inset", "flatten"],
  },
];

export const manipulatorTools = (app: ToolApp): CatalogTool[] => MANIPULATORS.map((s) => manipulator(app, s));

export const shapingTools = (): CatalogTool[] => SHAPING;
