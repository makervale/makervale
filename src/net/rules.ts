/**
 * What the owner's rules mean in the room: who may build, who was removed, which kind of room it is. lib/rules signs
 * and checks them; owner-tools.ts changes them. Messages from removed people are ignored (transport's accept hook),
 * and their connection is closed a moment after everyone was told, so the removed person learns it and leaves.
 */
import type { Ctx } from "./context";
import { changed, inRoom, sendHello, system } from "./context";
import { myPersonKey } from "./person";
import { saveRoom } from "./saved-rooms";
import { kindOf } from "./state";

const DROP_AFTER_MS = 2500;

/** how the rules name someone: their key for this room, or their visit until they proved one */
export function personOf(ctx: Ctx, pid: string): string {
  const n = ctx.net;
  if (pid === n.selfId) return myPersonKey(n.id);
  return n.peers.get(pid)?.person || "peer:" + pid;
}

export function banned(ctx: Ctx, pid: string): boolean {
  const list = ctx.net.rules?.banned;
  return !!list && (list.includes(personOf(ctx, pid)) || list.includes("peer:" + pid));
}

export function canBuild(ctx: Ctx, pid: string): boolean {
  const r = ctx.net.rules;
  if (!r || pid === r.host) return true;
  const who = personOf(ctx, pid);
  if (banned(ctx, pid) || r.deny.includes(who)) return false;
  return r.allow.includes(who) || r.build === "all";
}

/** never in a world you are only viewing; always in your own scene */
export const canIBuild = (ctx: Ctx): boolean => !ctx.net.viewing && (!inRoom(ctx) || canBuild(ctx, ctx.net.selfId));

/** the owner of the room is the one holding its key, in whichever visit */
export const amOwner = (ctx: Ctx): boolean => inRoom(ctx) && ctx.rules.ownsRules(ctx.net.rules);

export const ownerId = (ctx: Ctx): string => ctx.net.rules?.host ?? "";

export function dropPeer(ctx: Ctx, pid: string): void {
  ctx.link?.drop(pid);
  if (ctx.net.peers.delete(pid)) ctx.deps.peers.remove(pid);
}

/** rules that arrived from a peer: only signed ones for this room, from the first owner seen, and only newer */
export async function acceptRules(ctx: Ctx, raw: unknown): Promise<void> {
  const room = ctx.net.id;
  const r = await ctx.rules.checkRules(raw, room);
  if (!r || ctx.net.id !== room) return;
  const cur = ctx.net.rules;
  if (cur && (cur.owner !== r.owner || r.ver <= cur.ver)) return;
  const was = snapshotOf(ctx);
  ctx.net.rules = r;
  applyRules(ctx, was);
}

export interface Before {
  build: boolean;
  kind: string;
}

export const snapshotOf = (ctx: Ctx): Before => ({ build: canIBuild(ctx), kind: kindOf(ctx.net) });

function removeBanned(ctx: Ctx): void {
  for (const [pid, p] of [...ctx.net.peers]) {
    if (!banned(ctx, pid)) continue;
    system(ctx, (p.name || "Someone") + " was removed by the owner");
    ctx.net.peers.delete(pid);
    ctx.deps.peers.remove(pid);
    setTimeout(() => ctx.link?.drop(pid), DROP_AFTER_MS);
  }
}

function tellChanges(ctx: Ctx, was: Before): void {
  const now = canIBuild(ctx);
  const kind = kindOf(ctx.net);
  if (kind !== was.kind) system(ctx, kind === "public" ? "This room is public now." : "This room is private now.");
  if (now === was.build) return;
  system(ctx, now ? "You can build here now." : "You can't build here any more: you can still walk, chat and play.");
  if (!now) ctx.deps.commands.notice("The owner stopped your building in this room.");
  ctx.deps.bus.emit("build:allowed", { allowed: now });
}

/** the rules changed (ours or the owner's): act on them */
export function applyRules(ctx: Ctx, was: Before): void {
  const r = ctx.net.rules;
  if (!r) return;
  if (banned(ctx, ctx.net.selfId)) {
    system(ctx, "The owner removed you from this room.");
    ctx.deps.commands.notice("The owner removed you from this room. Your own scene is back.");
    void ctx.leave();
    return;
  }
  // tell everyone first (so a removed person learns it and leaves), then close the connection to them
  sendHello(ctx);
  removeBanned(ctx);
  tellChanges(ctx, was);
  void saveRoom(ctx);
  ctx.deps.scripts.resync();
  changed(ctx);
}
