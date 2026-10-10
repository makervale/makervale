/** Your own scene, kept aside while you are in a room and given back when you leave. */
import type { World } from "@/world/model";
import type { Ctx } from "./context";
import { loadWorld } from "./sync/snapshot";

const stashes = new WeakMap<Ctx, World>();

/** keep a copy of the scene before a room replaces it (only the first time: room to room keeps the original) */
export function stashOwnScene(ctx: Ctx): void {
  if (!stashes.has(ctx)) stashes.set(ctx, structuredClone(ctx.deps.store.world));
}

export function restoreOwnScene(ctx: Ctx): void {
  const own = stashes.get(ctx);
  if (!own) return;
  stashes.delete(ctx);
  // keep counting object ids from wherever the room got to, so ids stay unique
  loadWorld(ctx, { objects: own.objects, seq: Math.max(ctx.deps.store.world.seq, own.seq) });
}
