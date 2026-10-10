/**
 * Host controls: whether others may build, and removing people. lib/rules signs and checks the rules; this file
 * decides what they mean for the room. Messages from removed peers are ignored (transport's accept hook), and their
 * connection is closed a moment after everyone was told, so the removed person learns it and leaves on their own.
 */
import type { Ctx } from "./context";
import { changed, inRoom, sendHello, system } from "./context";
import { saveRoom } from "./saved-rooms";

/** time for the new rules to reach a removed peer before we hang up on them */
const DROP_AFTER_MS = 2500;

export const banned = (ctx: Ctx, pid: string): boolean => !!ctx.net.rules?.banned.includes(pid);

/** may this peer change the scene? */
export function canBuild(ctx: Ctx, pid: string): boolean {
  const r = ctx.net.rules;
  return !r || r.build === "all" || pid === r.host;
}

/** may I build here? (always, outside rooms) */
export const canIBuild = (ctx: Ctx): boolean => !inRoom(ctx) || canBuild(ctx, ctx.net.selfId);

export const amHost = (ctx: Ctx): boolean => inRoom(ctx) && ctx.rules.ownsRules(ctx.net.rules);

export const hostId = (ctx: Ctx): string => ctx.net.rules?.host ?? "";

/** forget a peer and hang up on them */
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
  const wasBuild = canIBuild(ctx);
  ctx.net.rules = r;
  applyRules(ctx, wasBuild);
}

function removeBanned(ctx: Ctx, banned: string[]): void {
  for (const [pid, p] of [...ctx.net.peers]) {
    if (!banned.includes(pid)) continue;
    system(ctx, (p.name || "Someone") + " was removed by the host");
    ctx.net.peers.delete(pid);
    ctx.deps.peers.remove(pid);
    setTimeout(() => ctx.link?.drop(pid), DROP_AFTER_MS);
  }
}

function tellBuildChange(ctx: Ctx, wasBuild: boolean): void {
  const now = canIBuild(ctx);
  if (now === wasBuild) return;
  if (now) system(ctx, "The host allowed everyone to build.");
  else {
    system(ctx, "The host made building host-only.");
    ctx.deps.commands.notice("Only the host can build in this room now.");
  }
  ctx.deps.bus.emit("build:allowed", { allowed: now });
}

/** the rules changed (ours or the host's): act on them */
export function applyRules(ctx: Ctx, wasBuild: boolean): void {
  const r = ctx.net.rules;
  if (!r) return;
  if (r.banned.includes(ctx.net.selfId)) {
    system(ctx, "The host removed you from this room.");
    ctx.deps.commands.notice("The host removed you from this room. Your own scene is back.");
    void ctx.leave();
    return;
  }
  // tell everyone first (so a removed person learns it and leaves), then close the connection to them
  sendHello(ctx);
  removeBanned(ctx, r.banned);
  tellBuildChange(ctx, wasBuild);
  void saveRoom(ctx);
  ctx.deps.scripts.resync();
  changed(ctx);
}

/** host: let others build, or not */
export async function setBuildRule(ctx: Ctx, everyone: boolean): Promise<void> {
  if (!ctx.net.rules) return;
  const r = await ctx.rules.updateRules(ctx.net.rules, { build: everyone ? "all" : "host" });
  if (!r) return;
  ctx.net.rules = r;
  applyRules(ctx, true);
}

/** host: remove someone from the room */
export async function kick(ctx: Ctx, pid: string): Promise<void> {
  const cur = ctx.net.rules;
  if (!cur || pid === ctx.net.selfId) return;
  const r = await ctx.rules.updateRules(cur, { banned: [...cur.banned, pid] });
  if (!r) return;
  ctx.net.rules = r;
  applyRules(ctx, true);
}
