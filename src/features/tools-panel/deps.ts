import type { Bus } from "@/app/bus";
import type { Commands } from "@/app/commands";
import type { Store } from "@/app/store";
import type { ToolRunner } from "@/app/tool-runner";
import type { Renderer } from "@/render/renderer";
import type { Prefs } from "./prefs";

/** a tool category, in the order the panel lists them (defined with the tools, in features/tools) */
export interface Category {
  id: string;
  name: string;
}

export interface ToolsPanelDeps {
  store: Store;
  bus: Bus;
  commands: Commands;
  runner: ToolRunner;
  renderer: Pick<Renderer, "framing">;
  categories: Category[];
  /** pins and recent tools; main.ts creates one and also hands it to the Build window */
  prefs: Prefs;
}
