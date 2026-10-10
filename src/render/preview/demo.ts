/** Run a tool on its own demo scene, away from the world: the "before" and "after" of its illustration. */
import { demoContext } from "@/app/tool-runner";
import type { Params, ToolContext, ToolDef } from "@/app/tools";
import { defaultParams } from "@/app/tools";
import type { Mesh } from "@/lib/mesh/mesh";
import { cloneMesh } from "@/lib/mesh/mesh";
import type { ElementSelection } from "@/lib/mesh/selection";
import { cloneSelection, emptySelection } from "@/lib/mesh/selection";

export interface DemoShot {
  mesh: Mesh;
  selection: ElementSelection;
}

export interface DemoResult {
  before: DemoShot | null;
  after: DemoShot | null;
  error?: string;
}

const EMPTY: DemoResult = { before: null, after: null };

export function runDemo(t: ToolDef, over?: Params): DemoResult {
  if (!t.demo && !t.demoRun) return EMPTY;
  try {
    return demoOf(t, over);
  } catch (e) {
    return { ...EMPTY, error: e instanceof Error ? e.message : String(e) };
  }
}

function demoOf(t: ToolDef, over?: Params): DemoResult {
  const demo = t.demo;
  const base: Mesh = demo ? demo.mesh() : { v: [], f: [], fm: [] };
  const start = demo?.selection ? demo.selection(base) : emptySelection();
  const ctx = demoContext(base, cloneSelection(start), demo?.mode ?? "object", demo?.size);
  const before = t.kind === "create" ? null : { mesh: cloneMesh(base), selection: cloneSelection(start) };
  const params = defaultParams(t, { ...demo?.params, ...over });
  if (t.demoRun) t.demoRun(ctx, params);
  else t.run(ctx, params);
  if (t.kind === "create") return { before, after: createdShape(ctx) };
  return { before, after: { mesh: ctx.obj!.mesh, selection: ctx.selection } };
}

/** a created shape lives in unit space: bake its size in, so the picture shows its real proportions */
function createdShape(ctx: ToolContext): DemoShot {
  const made = ctx.world.objects[ctx.world.objects.length - 1];
  const mesh = cloneMesh(made.mesh);
  for (const v of mesh.v) for (let k = 0; k < 3; k++) v[k] *= made.size[k];
  return { mesh, selection: emptySelection() };
}
