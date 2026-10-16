/**
 * What you do with a room as a whole: make a copy of it, switch Keep online, change its kind, delete it for
 * everyone (the owner) or just from this browser (anyone).
 */
import type { Ctx } from "./context";
import { changed, inRoom, system } from "./context";
import { saveAsNewRoom, sceneNow } from "./copies";
import { makePublic, setKeep } from "./owner-tools";
import { roomKeys } from "./room-keys";
import { leave, reopen } from "./rooms";
import { forgetRoom, readSavedRoom } from "./saved-rooms";
import { forgetVault, saveVaultNow } from "./vault";

/** a new private room of ours from the scene as it is now; we go there, the original stays as it was */
export async function makeCopy(ctx: Ctx): Promise<string> {
  const n = ctx.net;
  const id = await saveAsNewRoom(ctx, sceneNow(ctx), `${n.name} (copy)`, { title: n.name, version: "" });
  await leave(ctx);
  await reopen(ctx, id);
  system(ctx, "This is your own copy: change anything. The room you copied stays as it was.");
  return id;
}

async function forgetOnRelays(ctx: Ctx, code: string): Promise<void> {
  const keys = await roomKeys(code);
  const saved = await readSavedRoom(code);
  const owner = ctx.rules.ownerSecret(saved?.rules ?? ctx.net.rules);
  await forgetVault(keys, owner ? [keys.secret, owner] : [keys.secret], []);
}

export async function keepOnline(ctx: Ctx, on: boolean): Promise<void> {
  const code = ctx.net.id;
  if (!(await setKeep(ctx, on))) return;
  if (on) void saveVaultNow(ctx);
  else await forgetOnRelays(ctx, code).catch(() => {});
  changed(ctx);
}

export async function goPublic(ctx: Ctx): Promise<void> {
  const code = ctx.net.id;
  const kept = !!ctx.net.rules?.keep;
  if (!(await makePublic(ctx))) return;
  // a public room keeps nothing on the relays
  if (kept) await forgetOnRelays(ctx, code).catch(() => {});
}

/** the owner deletes a room: off the relays, out of this browser, and out of it if we are in it */
export async function deleteRoom(ctx: Ctx, code: string): Promise<boolean> {
  const saved = await readSavedRoom(code);
  const rules = inRoom(ctx) && ctx.net.id === code ? ctx.net.rules : (saved?.rules ?? null);
  if (!ctx.rules.ownsRules(rules)) return false;
  if (inRoom(ctx) && ctx.net.id === code) await leave(ctx);
  if (rules?.keep) await forgetOnRelays(ctx, code).catch(() => {});
  await forgetRoom(code);
  return true;
}
