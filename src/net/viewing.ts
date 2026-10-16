/**
 * Looking at a world from the Gallery: it replaces your scene for a while, alone and offline (nobody connects to
 * you), and you can't change it. Close it and your scene is back; make a copy and it becomes a private room of yours.
 */
import type { World } from "@/world/model";
import type { Ctx } from "./context";
import { changed, inRoom } from "./context";
import { saveAsNewRoom } from "./copies";
import { restoreOwnScene, stashOwnScene } from "./own-scene";
import { leave, reopen } from "./rooms";
import type { Viewing } from "./state";
import { loadWorld } from "./sync/snapshot";

const scenes = new WeakMap<Ctx, World>();

export async function view(ctx: Ctx, world: World, what: Viewing): Promise<void> {
  if (inRoom(ctx)) await leave(ctx);
  stashOwnScene(ctx);
  scenes.set(ctx, structuredClone(world));
  loadWorld(ctx, world);
  ctx.net.viewing = what;
  ctx.deps.bus.emit("build:allowed", { allowed: false });
  changed(ctx);
}

export function closeView(ctx: Ctx): void {
  if (!ctx.net.viewing) return;
  ctx.net.viewing = null;
  scenes.delete(ctx);
  restoreOwnScene(ctx);
  ctx.deps.scripts.resync();
  ctx.deps.bus.emit("build:allowed", { allowed: true });
  changed(ctx);
}

/** the world as published (not as its scripts moved it since), as a new private room of ours; we go there */
export async function copyViewed(ctx: Ctx): Promise<string | null> {
  const v = ctx.net.viewing;
  const world = scenes.get(ctx);
  if (!v || !world) return null;
  const id = await saveAsNewRoom(ctx, world, `${v.title} (copy)`, { title: v.title, version: "v" + v.version });
  closeView(ctx);
  await reopen(ctx, id);
  return id;
}
