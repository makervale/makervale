import type { Bus } from "@/app/bus";
import type { Commands } from "@/app/commands";
import type { Store } from "@/app/store";
import type { Renderer } from "@/render/renderer";

export interface MenubarDeps {
  store: Store;
  bus: Bus;
  commands: Commands;
  renderer: Pick<Renderer, "framing" | "views">;
}
