/**
 * Which copy of a room becomes the room when you come in: someone who is there right now always wins (sync/hello.ts);
 * otherwise the copy on the relays when it is newer than your own, or your own, saved in this browser. A copy taken
 * from the relays or from disk is "fresh" until something changes: a live copy that turns up replaces it.
 */
import type { Ctx } from "./context";
import { changed, sendHello, system } from "./context";
import { acceptRules } from "./rules";
import { saveRoom } from "./saved-rooms";
import { keepMyVersion } from "./copies";
import { fromAuthority, loadWorld } from "./sync/snapshot";
import type { VaultCopy } from "./vault";
import { loadVault } from "./vault";

const MINUTE_MS = 60_000;

function ago(at: number): string {
  const min = Math.round((Date.now() - at) / MINUTE_MS);
  if (min < 1) return "just now";
  if (min < 60) return min + " min ago";
  return min < 1440 ? Math.round(min / 60) + " h ago" : new Date(at).toLocaleDateString();
}

/** make the relays' copy the room; `live` when someone in the room vouched it is current (see onVaultSnap) */
export async function adoptVaultCopy(ctx: Ctx, copy: VaultCopy, live: boolean): Promise<void> {
  const n = ctx.net;
  const m = copy.manifest;
  await acceptRules(ctx, m.rules);
  loadWorld(ctx, copy.world);
  Object.assign(n, { name: m.name, synced: true, fresh: !live, ver: Math.max(n.ver, m.ver) });
  const count = copy.world.objects.length;
  system(ctx, `Opened "${m.name}" from its copy on the relays (saved ${ago(m.at)}, ${count} objects).`);
  sendHello(ctx);
  void saveRoom(ctx);
  ctx.deps.scripts.resync();
  changed(ctx);
}

/** we have no copy: the relays' copy is the room until someone who is there turns up */
export async function openFromRelays(ctx: Ctx, code: string): Promise<void> {
  const copy = await loadVault(ctx, code, null);
  if (!copy || ctx.net.id !== code || ctx.net.synced) {
    if (!copy && ctx.net.id === code && !ctx.net.synced) {
      system(ctx, "Nobody is in this room right now: waiting for someone who has it (in a public room, its owner)…");
    }
    return;
  }
  await adoptVaultCopy(ctx, copy, false);
}

/** we reopened our own copy: take the relays' copy instead if it is newer and nothing changed here meanwhile */
export async function catchUpFromRelays(ctx: Ctx, code: string): Promise<void> {
  const owner = ctx.net.rules?.owner ?? null;
  const copy = await loadVault(ctx, code, owner);
  const n = ctx.net;
  if (!copy || n.id !== code || !n.fresh || copy.manifest.ver <= n.ver) return;
  keepMyVersion(ctx);
  await adoptVaultCopy(ctx, copy, false);
}

/** someone in the room says its copy on the relays is current: take it (for those reached only through relays) */
export async function onVaultSnap(ctx: Ctx, from: string): Promise<void> {
  const n = ctx.net;
  if (n.synced && !n.fresh) return;
  const code = n.id;
  const copy = await loadVault(ctx, code, n.rules?.owner ?? null);
  if (!copy || n.id !== code || (n.synced && !n.fresh)) return;
  if (!fromAuthority(ctx, from)) return;
  await adoptVaultCopy(ctx, copy, true);
}
