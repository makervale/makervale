/** Put the app together: spine, renderer, bodies and the room, features, the start scene, then the frame loop. */
import { loadIdentity } from "@/features/avatar-window";
import { BUILD } from "@/features/menubar";
import { Renderer } from "@/render/renderer";
import { createBodies } from "./bodies";
import { createCore } from "./core";
import { mountFeatures } from "./features";
import { startLoop } from "./loop";
import { handleSceneRequests } from "./scene-requests";
import { autosave, startWorld } from "./start-world";
import { exposeTestHooks } from "./test-hooks";

export function boot(): void {
  const core = createCore();
  const canvas = document.getElementById("view") as HTMLCanvasElement;
  const stage = document.getElementById("stage")!;
  const renderer = new Renderer({ canvas, stage, ...core, revisionOf: (m) => core.commands.revisionOf(m) });
  const who = loadIdentity();
  const bodies = createBodies(core, renderer, who);
  const mounted = mountFeatures(core, renderer, bodies, who);
  handleSceneRequests(core, renderer);
  const origin = startWorld(core);
  autosave(core, { inOwnScene: () => bodies.session.inOwnScene() }, origin);
  // you start behind your avatar, at the gate
  bodies.avatar.placeCamera();
  renderer.resize();
  startLoop(core, renderer, bodies, mounted, BUILD);
  exposeTestHooks(core, renderer, bodies, mounted, BUILD);
}
