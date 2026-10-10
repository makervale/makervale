import type { Mesh } from "@/lib/mesh/mesh";
import { hasUV } from "@/lib/mesh/mesh";
import type { EditMode, ElementSelection } from "@/lib/mesh/selection";
import { faceSignature } from "@/lib/mesh/uv";
import type { Vec3 } from "@/lib/vec";
import { div3, normalize, quatInverse, rotate, scale } from "@/lib/vec";
import type { Obj, World } from "@/world/model";
import { emptyWorld, newObj } from "@/world/model";
import type { Bus } from "./bus";
import type { Commands } from "./commands";
import type { Store } from "./store";
import { needReason } from "./tool-needs";
import type { Params, Placement, ToolContext, ToolDef, ToolRegistry } from "./tools";
import { defaultParams } from "./tools";

const PLACEMENT_KEY = "__placement";
const INSTANT_KINDS = new Set(["mode", "option", "command", "select"]);

/** runs tools against the store, through commands, and remembers the last run for "adjust" */
export class ToolRunner {
  constructor(
    private readonly store: Store,
    private readonly commands: Commands,
    private readonly bus: Bus,
    readonly tools: ToolRegistry,
  ) {}

  run(id: string, over?: Params, placement?: Placement | null): boolean {
    const tool = this.tools.get(id);
    if (!tool) return false;
    const reason = needReason(this.store, tool.need);
    if (reason) {
      this.commands.notice(reason);
      return false;
    }
    const params = defaultParams(tool, over);
    if (tool.kind === "create") this.store.createParams[tool.id] = { ...params };
    if (INSTANT_KINDS.has(tool.kind ?? "op")) return this.runInstant(tool, params, placement);
    return this.runOperation(tool, params, placement);
  }

  /** undo the newest tool run and do it again with changed parameters */
  rerunLast(changes: Params): boolean {
    const entry = this.commands.history.last();
    if (!entry?.tool) return false;
    const tool = this.tools.get(entry.tool.id);
    if (!tool) return false;
    const params = entry.tool.params as Params & { [PLACEMENT_KEY]?: Placement };
    this.commands.history.revertLastForRerun();
    for (const o of this.store.world.objects) this.commands.meshChanged(o);
    this.bus.emit("tool:rerun");
    return this.run(tool.id, { ...params, ...changes }, params[PLACEMENT_KEY]);
  }

  context(placement?: Placement | null): ToolContext {
    const objs = this.store.selected();
    const obj = objs.length === 1 ? objs[0] : null;
    const { store, commands } = this;
    return {
      world: store.world,
      objs,
      obj,
      mesh: obj?.mesh ?? null,
      selection: store.selection.elements,
      mode: store.selection.mode,
      demo: false,
      placement,
      setSelection: (s) => (store.selection.elements = s),
      setMode: (m) => (store.selection.mode = m),
      selectObjects: (ids) => commands.selectObjects(ids),
      addObj: (o) => store.world.objects.push(o),
      removeObj: (id) => {
        commands.history.touch(id);
        store.world.objects = store.world.objects.filter((o) => o.id !== id);
      },
      localOffset: obj ? localOffsetFor(obj) : (n, metres) => scale(n, metres),
    };
  }

  private runInstant(tool: ToolDef, params: Params, placement?: Placement | null): boolean {
    const ctx = this.context(placement);
    const message = tool.run(ctx, params) ?? undefined;
    this.store.selection.elements = ctx.selection;
    this.store.selection.mode = ctx.mode;
    this.bus.emit("selection:changed");
    this.bus.emit("mode:changed");
    if (message) this.commands.notice(message);
    return true;
  }

  private runOperation(tool: ToolDef, params: Params, placement?: Placement | null): boolean {
    const ids = this.store.selected().map((o) => o.id);
    const ctx = this.context(placement);
    const uvBefore = ctx.mesh && hasUV(ctx.mesh) ? faceSignature(ctx.mesh) : null;
    let message: string | undefined;
    const stored = placement ? { ...params, [PLACEMENT_KEY]: placement } : params;
    const entry = this.commands.act(
      tool.name,
      ids,
      () => {
        message = tool.run(ctx, params) ?? undefined;
        if (uvBefore && ctx.mesh && !tool.id.startsWith("uv")) dropStaleUV(ctx.mesh, uvBefore);
        this.store.selection.elements = ctx.selection;
        this.store.selection.mode = ctx.mode;
      },
      { id: tool.id, params: stored },
    );
    this.bus.emit("selection:changed");
    this.bus.emit("mode:changed");
    if (entry && tool.params?.length) this.bus.emit("tool:ran", { entry });
    if (message) this.commands.notice(message);
    return true;
  }
}

/** the texture layout no longer fits once the faces changed */
function dropStaleUV(mesh: Mesh, signatureBefore: string): void {
  if (!hasUV(mesh) || faceSignature(mesh) !== signatureBefore) delete mesh.uv;
}

function localOffsetFor(o: Obj) {
  return (n: Vec3, metres: number): Vec3 => {
    const size = o.size.map((s) => Math.max(1e-6, s)) as Vec3;
    const worldNormal = normalize(rotate(div3(n, size), o.quat));
    return div3(rotate(scale(worldNormal, metres), quatInverse(o.quat)), size);
  };
}

/** a context on a throwaway object, for previews and tests */
export function demoContext(
  mesh: Mesh,
  selection: ElementSelection,
  mode: EditMode,
  size: Vec3 = [1, 1, 1],
): ToolContext {
  const world: World = emptyWorld();
  const obj = newObj(world, mesh, [0, 0, 0], size);
  world.objects.push(obj);
  const ctx: ToolContext = {
    world,
    objs: [obj],
    obj,
    mesh,
    selection,
    mode,
    demo: true,
    placement: { at: [0, 0, 0], normal: [0, 0, 1] },
    setSelection: (s) => (ctx.selection = s),
    setMode: (m) => (ctx.mode = m),
    selectObjects: () => {},
    addObj: (o) => world.objects.push(o),
    removeObj: (id) => (world.objects = world.objects.filter((o) => o.id !== id)),
    localOffset: localOffsetFor(obj),
  };
  return ctx;
}
