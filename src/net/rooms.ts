/**
 * Opening, joining, reopening and leaving rooms. Whoever opens a room brings the scene; newcomers get a copy from
 * someone already there (sync/hello.ts). A private room nobody is in opens from your saved copy or its copy on the
 * relays; a public room only opens while its owner is in it. Your own scene waits aside meanwhile.
 */
import type { RoomKind } from "@/lib/rules";
import type { Ctx } from "./context";
import { changed, inRoom, sendHello, system } from "./context";
import { resetModeration } from "./moderation";
import { restoreOwnScene, stashOwnScene } from "./own-scene";
import { withdraw } from "./public-rooms";
import { catchUpFromRelays, openFromRelays } from "./room-copies";
import { displayCode, newRoomCode } from "./room-code";
import { banned, canIBuild } from "./rules";
import type { Origin, SavedRoom } from "./saved-rooms";
import { readSavedRoom, saveRoom, setOrigin } from "./saved-rooms";
import { kindOf, noVault } from "./state";
import { fileForPeer } from "./sync/files";
import { onPeerJoin, onPeerLeave } from "./sync/hello";
import { listenAll } from "./sync/index";
import { dropQueuedObjs } from "./sync/objects";
import { loadWorld } from "./sync/snapshot";
import { openTransport } from "./transport";
import { flushVault, resetVault } from "./vault";

/** a public room whose owner doesn't show up in this long is closed */
const OWNER_WAIT_MS = 15_000;

function buildMayHaveChanged(ctx: Ctx, was: boolean): void {
  const now = canIBuild(ctx);
  if (now !== was) ctx.deps.bus.emit("build:allowed", { allowed: now });
}

function enter(ctx: Ctx, id: string): void {
  Object.assign(ctx.net, { id, chat: [], vault: noVault() });
  resetVault(ctx);
  resetModeration(ctx);
  const link = openTransport(id, {
    accept: (pid) => !banned(ctx, pid),
    onJoinError: (reason) => system(ctx, "Could not connect to someone: " + reason),
    onPeerJoin: (pid) => onPeerJoin(ctx, pid),
    onPeerLeave: (pid) => onPeerLeave(ctx, pid),
    fileRequest: (hash) => fileForPeer(ctx, hash),
  });
  ctx.link = link;
  listenAll(ctx, link);
  ctx.deps.scripts.resync();
  changed(ctx);
  ctx.deps.bus.emit("room:joined");
}

/** open a new room with the current scene; resolves with its code */
export async function host(ctx: Ctx, name: string, kind: RoomKind, basedOn: Origin | null = null): Promise<string> {
  const id = newRoomCode();
  const n = ctx.net;
  const rules = await ctx.rules.newRules(id, n.selfId, kind);
  stashOwnScene(ctx);
  Object.assign(n, { name, kind, synced: true, ver: 1, fresh: false, rules, pending: false });
  setOrigin(ctx, basedOn);
  enter(ctx, id);
  system(ctx, `You opened "${name}".`);
  void saveRoom(ctx);
  return id;
}

/** a public room nobody can open without its owner: if they aren't here soon, it is closed */
function expectOwner(ctx: Ctx, id: string): void {
  setTimeout(() => {
    const n = ctx.net;
    if (n.id !== id || n.synced || kindOf(n) !== "public") return;
    ctx.deps.commands.notice("That public room is closed: its owner isn't in it right now.");
    void ctx.leave();
  }, OWNER_WAIT_MS);
}

/** join by code; for a private room our saved copy is used when we have one */
export async function join(ctx: Ctx, id: string, kind: RoomKind = "private", name = ""): Promise<void> {
  const saved = await readSavedRoom(id);
  stashOwnScene(ctx);
  if (saved && (saved.rules?.kind !== "public" || ctx.rules.ownsRules(saved.rules))) return reopenSaved(ctx, saved);
  const room = { name: name || "Room " + displayCode(id), kind, synced: false, ver: 0, fresh: false, rules: null };
  Object.assign(ctx.net, { ...room, pending: false });
  setOrigin(ctx, null);
  enter(ctx, id);
  system(ctx, "Joining " + (name ? `"${name}"` : "room " + displayCode(id)) + "…");
  if (kind === "public") expectOwner(ctx, id);
  // nobody there? the room's copy on the relays, if it is kept there, is the room
  else void openFromRelays(ctx, id);
}

export async function reopen(ctx: Ctx, id: string): Promise<boolean> {
  const saved = await readSavedRoom(id);
  if (!saved) return false;
  stashOwnScene(ctx);
  reopenSaved(ctx, saved);
  return true;
}

/** our own room: our visit is its host now */
async function claimHost(ctx: Ctx, id: string): Promise<void> {
  const n = ctx.net;
  if (!n.rules || !ctx.rules.ownsRules(n.rules)) return;
  const was = canIBuild(ctx);
  const r = await ctx.rules.updateRules(n.rules, { host: n.selfId });
  if (!r || n.id !== id) return;
  n.rules = r;
  sendHello(ctx);
  buildMayHaveChanged(ctx, was);
  changed(ctx);
}

function reopenSaved(ctx: Ctx, saved: SavedRoom): void {
  const was = canIBuild(ctx);
  loadWorld(ctx, saved.world);
  const kind = saved.rules?.kind ?? "private";
  const room = { name: saved.name, kind, synced: true, ver: saved.ver, fresh: true, pending: saved.pending };
  Object.assign(ctx.net, { ...room, rules: saved.rules });
  setOrigin(ctx, saved.basedOn);
  enter(ctx, saved.id);
  buildMayHaveChanged(ctx, was);
  void claimHost(ctx, saved.id);
  if (saved.rules?.keep) void catchUpFromRelays(ctx, saved.id);
  system(ctx, `You opened "${saved.name}" from your copy. Anyone in it with a newer one updates it.`);
}

function forgetRoomState(ctx: Ctx): void {
  const n = ctx.net;
  for (const pid of n.peers.keys()) ctx.deps.peers.remove(pid);
  n.peers.clear();
  Object.assign(n, { id: "", chat: [], synced: false, rules: null, kind: "private", vault: noVault() });
}

/** leave the room (our copy is saved first) and get our own scene back */
export async function leave(ctx: Ctx): Promise<void> {
  const link = ctx.link;
  if (!link) return;
  const was = canIBuild(ctx);
  // the room's copy on the relays is saved in the background, from the scene as it is now
  void flushVault(ctx);
  await saveRoom(ctx);
  ctx.link = null;
  withdraw();
  dropQueuedObjs(ctx);
  forgetRoomState(ctx);
  // your own scene comes back at once; closing the connection can take a while (or fail) and must not hold it up
  restoreOwnScene(ctx);
  ctx.deps.scripts.resync();
  buildMayHaveChanged(ctx, was);
  changed(ctx);
  ctx.deps.bus.emit("room:left");
  await link.leave().catch(() => {});
}

/** best effort when the tab closes: take the room off the public list, and keep our copy */
export function onPageHide(ctx: Ctx): void {
  if (!inRoom(ctx)) return;
  withdraw();
  void flushVault(ctx);
  void saveRoom(ctx);
}
