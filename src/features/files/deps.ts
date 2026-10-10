import type { Bus } from "@/app/bus";
import type { Commands } from "@/app/commands";
import type { Store } from "@/app/store";
import type { Renderer } from "@/render/renderer";
import type { World } from "@/world/model";

export interface FilesDeps {
  store: Store;
  bus: Bus;
  commands: Commands;
  renderer: Pick<Renderer, "framing">;
  /** a saved project of any version → today's world (world/migrate.ts); throws on what isn't a world */
  loadWorld(raw: unknown): World;
  /** the start scene (world/sample) */
  sampleWorld(): World;
}
