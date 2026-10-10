/**
 * Every tool card: what the catalog shows, what the pie menu offers and what runs. The order is the catalog's
 * order (the first half are the classic tools, the rest came later), and ids are stable: search, saved pins and
 * the end-to-end tests refer to them.
 */
import type { ToolRegistry } from "@/app/tools";
import type { CatalogTool, ToolApp } from "./app";
import { standaloneToolApp } from "./app";
import { booleanTool } from "./boolean";
import { createTools } from "./create";
import { edgeBuildTools } from "./edge-build";
import { bevelTools, edgeTools } from "./edges";
import { detachTool, separateTools } from "./face-parts";
import { faceTools, normalTools } from "./faces";
import { materialTools, uvTools } from "./material";
import { meshTools } from "./mesh";
import { modifierTools } from "./modifiers";
import { objectTools } from "./objects";
import { physicsTools } from "./physics";
import { optionTools } from "./options";
import { PLANE_CUT } from "./plane-cut";
import { fileTools, reportTools } from "./quality";
import { sceneTools } from "./scene";
import { selectTools } from "./select";
import { smartSelectTools } from "./select-more";
import { manipulatorTools, shapingTools } from "./transform";
import { spikeTool, vertTools } from "./verts";

export { CATEGORIES, standaloneToolApp } from "./app";
export type { CatalogTool, Category, ToolApp } from "./app";

export function allTools(app: ToolApp): CatalogTool[] {
  return [
    ...createTools(),
    ...selectTools(),
    ...manipulatorTools(app),
    ...shapingTools(),
    ...optionTools(app),
    ...faceTools(app),
    ...separateTools(),
    ...normalTools(),
    ...edgeTools(),
    ...vertTools(),
    ...meshTools(),
    ...objectTools(app),
    ...sceneTools(app),
    ...materialTools(),
    ...reportTools(app),
    ...bevelTools(),
    ...edgeBuildTools(),
    PLANE_CUT,
    ...modifierTools(),
    detachTool(),
    spikeTool(),
    booleanTool(app),
    ...fileTools(app),
    ...uvTools(),
    ...smartSelectTools(),
    ...physicsTools(app),
  ];
}

/** define every tool; without `app` the mode and option cards act on a store of their own (previews, tests) */
export function registerTools(registry: ToolRegistry, app: ToolApp = standaloneToolApp()): void {
  for (const tool of allTools(app)) registry.define(tool);
}
