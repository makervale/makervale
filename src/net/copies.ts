/**
 * New rooms made from a scene you have. "Make a copy" (of the room you are in, or of a world you are viewing) and
 * "your version" (changes nobody else ever received, about to give way to a newer copy) both become a private room
 * of your own, with a new link; the original stays as it was. A copy is never shared until you open it.
 */
import { restingWorld } from "@/world/resting";
import type { World } from "@/world/model";
import type { Ctx } from "./context";
import { changed, system } from "./context";
import { newRoomCode } from "./room-code";
import type { Origin } from "./saved-rooms";
import { storeRoomCopy } from "./saved-rooms";

export const sceneNow = (ctx: Ctx): World => structuredClone(restingWorld(ctx.deps.store.world));

/** a new private room of ours with this scene, saved in this browser (not opened); resolves with its code */
export async function saveAsNewRoom(ctx: Ctx, world: World, name: string, basedOn: Origin | null): Promise<string> {
  const id = newRoomCode();
  const rules = await ctx.rules.newRules(id, "", "private");
  await storeRoomCopy({
    id,
    name: name.slice(0, 60),
    ver: 1,
    savedAt: Date.now(),
    world,
    rules,
    pending: false,
    basedOn,
  });
  return id;
}

/** our copy is about to give way: if it has changes nobody else has, keep them as a room of our own first */
export function keepMyVersion(ctx: Ctx): void {
  const n = ctx.net;
  if (!n.pending) return;
  n.pending = false;
  const name = `${n.name} (your version)`;
  void saveAsNewRoom(ctx, sceneNow(ctx), name, { title: n.name, version: "" }).then(() => {
    const text = `Your changes that never reached anyone are kept as "${name}", under Your rooms.`;
    system(ctx, text);
    ctx.deps.commands.notice(text);
    changed(ctx);
  });
}
