/** Create: starting shapes, placed on the clicked ground or face. */
import type { ParamDef, Params, ToolContext } from "@/app/tools";
import * as G from "@/lib/mesh/generators";
import type { Mesh } from "@/lib/mesh/mesh";
import type { Quat, Vec3 } from "@/lib/vec";
import { add, cross, dot, normalize, scale } from "@/lib/vec";
import { newObj } from "@/world/model";
import type { CatalogTool } from "./app";
import { SIZE_PARAM, intParam, segmentsParam } from "./helpers";

/** how far a flat shape floats above the face it lies on, so they don't flicker */
const FLAT_LIFT_M = 0.002;

/** the rotation taking +Z onto unit vector n */
function upTo(n: Vec3): Quat {
  const r = dot([0, 0, 1], n) + 1;
  const q: Quat = r < 1e-6 ? [0, -1, 0, 0] : [...cross([0, 0, 1], n), r];
  const len = Math.hypot(...q);
  return q.map((x) => x / len) as Quat;
}

function placeNew(c: ToolContext, mesh: Mesh, size: Vec3, name: string, flat: boolean): string {
  const hint = c.placement ?? { at: [0, 0, 0], normal: [0, 0, 1] };
  const n = normalize(hint.normal);
  const half = flat
    ? FLAT_LIFT_M
    : (Math.abs(n[0]) * size[0] + Math.abs(n[1]) * size[1] + Math.abs(n[2]) * size[2]) / 2;
  const o = newObj(c.world, mesh, add(hint.at, scale(n, half)), size, { name });
  if (flat) o.quat = upTo(n);
  c.addObj(o);
  c.selectObjects([o.id]);
  return `${name}: ${mesh.v.length} vertices, ${mesh.f.length} faces`;
}

interface Shape {
  id: string;
  name: string;
  synonyms: string[];
  summary: string;
  params: ParamDef[];
  gen: (p: Params) => Mesh;
  dims?: (s: number) => Vec3;
  flat?: boolean;
}

function create(s: Shape): CatalogTool {
  const params = [SIZE_PARAM, ...s.params];
  const dims = s.dims ?? ((x: number): Vec3 => [x, x, x]);
  const defaults = (): Params => Object.fromEntries(params.map((d) => [d.key, d.def]));
  return {
    id: s.id,
    name: s.name,
    category: "create",
    kind: "create",
    need: "none",
    synonyms: s.synonyms,
    summary: s.summary,
    params,
    steps: [
      'Pick a shape in the Build window, or press "Use" here.',
      "Click the ground or a face of another object to place it.",
      "Change segments and size right away in the last-operation panel.",
    ],
    related: ["extrude", "loopcut", "subdivide"],
    run: (c, p) => placeNew(c, s.gen(p), dims(p.size), s.name, !!s.flat),
    demo: { mesh: () => s.gen(defaults()) },
  };
}

const double = (x: number): Vec3 => [x * 2, x * 2, x * 2];

const SHAPES: Shape[] = [
  {
    id: "box",
    name: "Cube",
    synonyms: ["cube", "box", "block", "cuboid", "wall", "plank", "brick"],
    summary: "A cube made of quad faces. Optionally divided into a grid.",
    params: [intParam("div", "Divisions", 1, 16, 1)],
    gen: (p: Params) => G.genBox(p.div),
  },
  {
    id: "plane",
    name: "Plane",
    synonyms: ["plane", "square", "floor", "ground", "terrain", "sheet", "grid"],
    summary: "A flat surface that lies on the clicked face. A good start for terrain and thin parts.",
    params: [intParam("div", "Divisions", 1, 64, 1)],
    gen: (p: Params) => G.genPlane(p.div),
    dims: double,
    flat: true,
  },
  {
    id: "cylinder",
    name: "Cylinder",
    synonyms: ["cylinder", "pillar", "column", "post", "pole", "barrel", "rod"],
    summary: "A cylinder with polygon caps. Rings divide it vertically.",
    params: [segmentsParam(24), intParam("rings", "Rings", 1, 64, 1)],
    gen: (p: Params) => G.genCylinder(p.seg, p.rings),
  },
  {
    id: "cone",
    name: "Cone",
    synonyms: ["cone", "spike", "point", "roof", "funnel", "round pyramid"],
    summary: "A cone with a polygon base.",
    params: [segmentsParam(24)],
    gen: (p: Params) => G.genCone(p.seg),
  },
  {
    id: "sphere",
    name: "UV sphere",
    synonyms: ["sphere", "uv sphere", "ball", "globe", "head", "round"],
    summary: "A ball made of meridians and parallels. Quads make loop cuts easy.",
    params: [segmentsParam(24)],
    gen: (p: Params) => G.genSphere(p.seg),
  },
  {
    id: "icosphere",
    name: "Icosphere",
    synonyms: ["icosphere", "geosphere", "triangle sphere", "ball", "rock", "stone"],
    summary: "A ball of equal triangles, with no poles. Good for rocks and organic shapes.",
    params: [intParam("level", "Subdivision level", 0, 5, 2)],
    gen: (p: Params) => G.genIcosphere(p.level),
  },
  {
    id: "torus",
    name: "Torus",
    synonyms: ["torus", "donut", "ring", "hoop", "lifebuoy", "tyre", "tire"],
    summary: "A ring with a round cross-section.",
    params: [
      segmentsParam(24),
      { key: "thick", label: "Thickness", min: 0.05, max: 0.95, step: 0.05, def: 0.35, decimals: 2 },
    ],
    gen: (p: Params) => G.genTorus(p.seg, p.thick),
    dims: (x: number): Vec3 => [x, x, x * 0.35],
  },
  {
    id: "tube",
    name: "Tube",
    synonyms: ["tube", "pipe", "ring", "sleeve", "hollow cylinder", "vase"],
    summary: "A cylinder with a hole all the way through.",
    params: [
      segmentsParam(24),
      { key: "wall", label: "Wall thickness", min: 0.02, max: 0.95, step: 0.02, def: 0.2, decimals: 2 },
    ],
    gen: (p: Params) => G.genTube(p.seg, p.wall),
  },
  {
    id: "stairs",
    name: "Stairs",
    synonyms: ["stairs", "steps", "staircase", "stair", "stairway"],
    summary: "A staircase shape. Change the number of steps in the last-operation panel.",
    params: [intParam("steps", "Steps", 1, 40, 5)],
    gen: (p: Params) => G.genStairs(p.steps),
    dims: double,
  },
];

export const createTools = (): CatalogTool[] => SHAPES.map(create);
