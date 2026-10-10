/**
 * Opening, joining, reopening and leaving rooms. Whoever opens a room brings the scene; newcomers get a copy from
 * someone already there (sync/hello.ts), or reopen their saved copy when nobody is. Your own scene waits aside.
 */
import { amAdvertiser, startAdvertising, stopAdvertising } from "./advertising";
import type { Ctx } from "./context";
import { changed, inRoom, sendHello, system } from "./context";
import { restoreOwnScene, stashOwnScene } from "./own-scene";
import { banned, canIBuild } from "./rules";
import type { SavedRoom } from "./saved-rooms";
import { readSavedRoom, saveRoom } from "./saved-rooms";
import { fileForPeer } from "./sync/files";
import { onPeerJoin, onPeerLeave } from "./sync/hello";
import { listenAll } from "./sync/index";
import { dropQueuedObjs } from "./sync/objects";
import { loadWorld } from "./sync/snapshot";
import { openTransport } from "./transport";

const ROOM_ID_LENGTH = 9;
/** no 0/o, 1/l/i: room codes are read out loud and typed */
const ROOM_ID_LETTERS = "abcdefghjkmnpqrstuvwxyz23456789";

export function newRoomId(): string {
  const bytes = crypto.getRandomValues(new Uint8Array(ROOM_ID_LENGTH));
  return Array.from(bytes, (b) => ROOM_ID_LETTERS[b % ROOM_ID_LETTERS.length]).join("");
}

/** tell the UI when entering or leaving changed whether I may build */
function buildMayHaveChanged(ctx: Ctx, was: boolean): void {
  const now = canIBuild(ctx);
  if (now !== was) ctx.deps.bus.emit("build:allowed", { allowed: now });
}

function enter(ctx: Ctx, id: string): void {
  ctx.net.id = id;
  ctx.net.chat = [];
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

/** open a room with the current scene (and list it publicly if asked); returns its code */
export function host(ctx: Ctx, name: string, listPublicly: boolean): string {
  const id = newRoomId();
  const n = ctx.net;
  stashOwnScene(ctx);
  Object.assign(n, { name, isPublic: listPublicly, synced: true, ver: 1, fresh: false, rules: null });
  enter(ctx, id);
  void ctx.rules.newRules(id, n.selfId).then((r) => {
    if (n.id !== id) return;
    n.rules = r;
    sendHello(ctx);
    void saveRoom(ctx);
    changed(ctx);
  });
  if (listPublicly) startAdvertising(ctx);
  system(ctx, `You opened "${name}". Room code: ${id}`);
  void saveRoom(ctx);
  return id;
}

/** join a room; the scene arrives from someone already there (or from our saved copy, if nobody is) */
export async function join(ctx: Ctx, id: string, name = ""): Promise<void> {
  const saved = await readSavedRoom(id);
  stashOwnScene(ctx);
  if (saved) {
    reopenSaved(ctx, saved);
    return;
  }
  Object.assign(ctx.net, { name: name || "Room " + id, synced: false, ver: 0, fresh: false, rules: null });
  enter(ctx, id);
  system(ctx, "Joining room " + id + "…");
}

/** reopen a room from your saved copy: it is the room until someone with a newer copy turns up */
export async function reopen(ctx: Ctx, id: string): Promise<boolean> {
  const saved = await readSavedRoom(id);
  if (!saved) return false;
  stashOwnScene(ctx);
  reopenSaved(ctx, saved);
  return true;
}

/** our own room: say that we are its host in this session */
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
  const room = { name: saved.name, isPublic: saved.pub, synced: true, ver: saved.ver, fresh: true };
  Object.assign(ctx.net, { ...room, rules: saved.rules ?? null });
  enter(ctx, saved.id);
  if (saved.pub) startAdvertising(ctx);
  buildMayHaveChanged(ctx, was);
  void claimHost(ctx, saved.id);
  const count = saved.world.objects.length;
  system(
    ctx,
    `You reopened "${saved.name}" from your saved copy (${count} objects). Anyone with a newer copy will update it.`,
  );
}

function forgetRoomState(ctx: Ctx): void {
  const n = ctx.net;
  for (const pid of n.peers.keys()) ctx.deps.peers.remove(pid);
  n.peers.clear();
  Object.assign(n, { id: "", advertiser: "", chat: [], synced: false, rules: null });
}

/** leave the room (our copy is saved first) and get our own scene back */
export async function leave(ctx: Ctx): Promise<void> {
  const link = ctx.link;
  if (!link) return;
  const was = canIBuild(ctx);
  await saveRoom(ctx);
  ctx.link = null;
  if (amAdvertiser(ctx)) stopAdvertising();
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
  if (amAdvertiser(ctx)) stopAdvertising();
  void saveRoom(ctx);
}
