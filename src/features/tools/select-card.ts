/** A select card runs at once (no undo entry) and hands back the new element selection, or a message. */
import type { Demo, Need, Params, ToolContext } from "@/app/tools";
import type { ElementSelection } from "@/lib/mesh/selection";
import { topologyOf } from "@/lib/mesh/topology";
import type { CatalogTool } from "./app";
import { allFaces, allVerts, sel } from "./helpers";

export interface SelectCard {
  id: string;
  name: string;
  key?: string;
  need: Need;
  synonyms: string[];
  summary: string;
  steps: string[];
  pick: (c: ToolContext, p: Params) => ElementSelection | string | void;
  demo?: Demo;
  extra?: Partial<CatalogTool>;
}

export function selectTool(s: SelectCard): CatalogTool {
  return {
    id: s.id,
    name: s.name,
    category: "select",
    kind: "select",
    key: s.key,
    need: s.need,
    synonyms: s.synonyms,
    summary: s.summary,
    steps: s.steps,
    demo: s.demo,
    run: (c, p) => {
      const r = s.pick(c, p);
      if (r && typeof r === "object") c.setSelection(r);
      else return r ?? undefined;
    },
    ...s.extra,
  };
}

export function selectAll(c: ToolContext): ElementSelection | void {
  if (!c.mesh || c.mode === "object") {
    c.selectObjects(c.world.objects.filter((o) => !o.hidden).map((o) => o.id));
    return;
  }
  const m = c.mesh;
  if (c.mode === "vert") return sel([], [], allVerts(m));
  if (c.mode === "edge") return sel([], [...topologyOf(m).edges.keys()]);
  return sel(allFaces(m));
}
