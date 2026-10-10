/** "tool:use": what picking a tool anywhere (catalog, search, pie, shortcut) does. */
import type { Params } from "@/app/tools";
import { isOpen, showWindow } from "@/ui/window";
import type { LiveEnv } from "./env";
import { startLive } from "./lifecycle";

const MANIPULATOR_MODES = new Set(["move", "rotate", "scale"]);

export function useTool(env: LiveEnv, id: string, params?: Params): void {
  const t = env.runner.tools.get(id);
  if (!t) return;
  if (!isOpen("build")) showWindow("build", true); // using a tool means building
  const { commands } = env;
  if (t.kind === "create") {
    commands.setCreateType(t.id);
    commands.setToolMode("create");
    commands.notice("Click the ground or a face of an object to place: " + t.name);
    return;
  }
  if (t.kind === "mode" && MANIPULATOR_MODES.has(t.id)) commands.setToolMode("edit");
  startLive(env, t, params);
}
