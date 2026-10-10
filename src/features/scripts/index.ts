/**
 * The script runtime. `mount` wires it to the bus and hands it back: main.ts passes it to net (as the ScriptBridge),
 * to the Build window (errors, restart, touchable) and calls `tick(dt)` every frame.
 */
import type { ScriptDeps } from "./deps";
import { ScriptRuntime } from "./runtime";

export type { ScriptDeps } from "./deps";
export { ScriptRuntime, touchable } from "./runtime";

const DEFAULT_NAME = "me";

export function mount(deps: ScriptDeps): ScriptRuntime {
  const runtime = new ScriptRuntime(deps);
  const myName = deps.myName ?? (() => DEFAULT_NAME);
  deps.bus.on("object:touched", ({ id }) => runtime.touch(id, myName()));
  deps.bus.on("world:changed", () => runtime.resync());
  deps.bus.on("object:bumped", ({ id, by }) => runtime.bump(id, deps.store.byId(by)?.name ?? by));
  runtime.resync();
  return runtime;
}
