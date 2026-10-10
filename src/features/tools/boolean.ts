/** Boolean: subtract, add or intersect two solids. */
import type { ToolContext } from "@/app/tools";
import { IDENTITY, composeMatrix } from "@/lib/mesh/affine";
import { booleanOp } from "@/lib/mesh/boolean";
import type { BoolOp } from "@/lib/mesh/boolean";
import * as G from "@/lib/mesh/generators";
import type { Mesh } from "@/lib/mesh/mesh";
import type { Params } from "@/app/tools";
import type { Obj } from "@/world/model";
import type { CatalogTool, ToolApp } from "./app";
import { intParam } from "./helpers";
import { lastSelected } from "./objects";

const OPS: BoolOp[] = ["subtract", "union", "intersect"];

const placed = (o: Obj) => ({ mesh: o.mesh, matrix: composeMatrix(o.pos, o.quat, o.size) });

function runBoolean(app: ToolApp, c: ToolContext, p: Params): string {
  const b = lastSelected(app, c.objs);
  const a = c.objs.find((o) => o !== b);
  if (!a || c.objs.length !== 2) throw new Error("Select exactly two objects");
  const out = booleanOp(placed(a), placed(b), OPS[p.op], a.materials.length);
  if (!out.f.length) throw new Error("The result is empty: the solids do not overlap");
  a.mesh = out;
  a.materials = [...a.materials, ...b.materials.map((m) => ({ ...m, name: b.name + ": " + m.name }))];
  if (!p.keep) c.removeObj(b.id);
  c.selectObjects([a.id]);
  c.setMode("object");
  return `${a.name}: ${out.f.length} faces`;
}

/** a cube with a hole drilled through it */
function drilledCube(): Mesh {
  const drill = G.genCylinder(16);
  for (const v of drill.v) {
    v[0] *= 0.5;
    v[1] *= 0.5;
    v[2] *= 1.4;
  }
  return booleanOp({ mesh: G.genBox(1), matrix: IDENTITY }, { mesh: drill, matrix: IDENTITY }, "subtract", 1);
}

export function booleanTool(app: ToolApp): CatalogTool {
  return {
    id: "boolean",
    name: "Boolean",
    category: "objects",
    need: "objects2",
    synonyms: ["boolean", "csg", "union", "subtract", "difference", "intersect", "hole", "drill", "cut with object"],
    summary: "Subtracts, adds or intersects two solids. The last selected object is the tool (e.g. a drill).",
    steps: [
      "Select a solid, then Shift+click the tool solid that should cut it.",
      "Choose the operation in the last-operation panel.",
      "Afterwards, Clean up mesh helps.",
    ],
    params: [
      {
        ...intParam("op", "Operation", 0, 2, 0),
        options: ["subtract the tool", "add (join into one solid)", "intersection"],
      },
      { ...intParam("keep", "Tool", 0, 1, 0), options: ["delete afterwards", "keep"] },
    ],
    run: (c, p) => runBoolean(app, c, p),
    demo: { mesh: drilledCube, mode: "object" },
    demoRun: () => {},
    related: ["cleanup", "join"],
  };
}
