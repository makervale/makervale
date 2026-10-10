import type { Mesh } from "@/lib/mesh/mesh";
import type { EditMode, ElementSelection } from "@/lib/mesh/selection";
import type { Vec3 } from "@/lib/vec";
import type { Obj, World } from "@/world/model";

/** what a tool needs selected before it can run */
export type Need =
  | "none"
  | "objects"
  | "obj1"
  | "objects2"
  | "mesh"
  | "elems"
  | "faces"
  | "edges"
  | "edge1"
  | "verts2"
  | "verts3"
  | "vert1"
  | "facesOrEdges"
  | "twoParts";

export type ToolKind = "op" | "select" | "mode" | "option" | "create" | "command";

export interface ParamDef {
  key: string;
  label: string;
  min: number;
  max: number;
  step: number;
  def: number;
  decimals?: number;
  unit?: string;
  options?: string[];
  help?: string;
}

export type Params = Record<string, number>;

export interface Placement {
  at: Vec3;
  normal: Vec3;
}

/** what a tool sees and may change while it runs */
export interface ToolContext {
  world: World;
  objs: Obj[];
  obj: Obj | null;
  mesh: Mesh | null;
  selection: ElementSelection;
  mode: EditMode;
  /** running for a preview, not on the real scene */
  demo: boolean;
  placement?: Placement | null;
  setSelection(s: ElementSelection): void;
  setMode(m: EditMode): void;
  selectObjects(ids: string[]): void;
  addObj(o: Obj): void;
  removeObj(id: string): void;
  /** the local-space offset that moves a point `metres` along local normal `n` */
  localOffset(n: Vec3, metres: number): Vec3;
}

export interface Demo {
  mesh: () => Mesh;
  selection?: (m: Mesh) => ElementSelection;
  mode?: EditMode;
  size?: Vec3;
  params?: Params;
  view?: Vec3;
}

/** how a tool behaves while active in the viewport: the mouse drives `param`, the wheel drives `wheel` */
export interface LiveSpec {
  param?: string;
  mode?: "axis" | "screen";
  /** world direction for axis mode; default: the selection's average normal */
  axis?: (ctx: ToolContext, p: Params) => Vec3 | null;
  wheel?: string;
  /** what must be clicked before the tool runs */
  pick?: "edge" | "knife";
  hint?: string;
  helper?: (ctx: ToolContext, p: Params) => { kind: "plane"; p: Vec3; n: Vec3; r: number } | null;
}

export interface ToolDef {
  id: string;
  name: string;
  category: string;
  summary: string;
  steps: string[];
  synonyms: string[];
  key?: string;
  need: Need;
  kind?: ToolKind;
  params?: ParamDef[];
  live?: LiveSpec;
  run(ctx: ToolContext, p: Params): string | void;
  demo?: Demo;
  demoRun?: (ctx: ToolContext, p: Params) => void;
  related?: string[];
  icon?: string;
  isOn?: () => boolean;
}

export class ToolRegistry {
  private readonly tools = new Map<string, ToolDef>();

  define(tool: ToolDef): ToolDef {
    this.tools.set(tool.id, tool);
    return tool;
  }

  get(id: string): ToolDef | undefined {
    return this.tools.get(id);
  }

  all(): ToolDef[] {
    return [...this.tools.values()];
  }
}

export function defaultParams(tool: ToolDef, over?: Params): Params {
  const p: Params = {};
  for (const d of tool.params ?? []) p[d.key] = d.def;
  return { ...p, ...over };
}
