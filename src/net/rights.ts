/**
 * Who someone is in the room's rules and whether they may build, from the signed rules alone: the same answer on
 * every screen. rules.ts says what the rules mean beyond that; the authority's pick (context.ts) needs this too.
 */
import type { Ctx } from "./context";
import { myPersonKey } from "./person";

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
