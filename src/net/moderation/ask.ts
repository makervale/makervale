/**
 * "Ask to build": a guest who may not build asks the owner, who sees it and lets them or not. At most once per two
 * minutes per guest, counted on both sides, so asking can't become a way to pester the owner.
 */
import type { Ctx } from "../context";
import { send } from "../context";
import { amOwner, canBuild, ownerId } from "../rules";

export const ASK_EVERY_MS = 120_000;

const lastAsked = new WeakMap<Ctx, number>();
const heard = new WeakMap<Ctx, Map<string, number>>();

/** false when asked too recently, or there is nobody to ask */
export function askToBuild(ctx: Ctx): boolean {
  const owner = ownerId(ctx);
  const now = Date.now();
  if (!owner || !ctx.net.peers.has(owner) || now - (lastAsked.get(ctx) ?? -Infinity) < ASK_EVERY_MS) return false;
  lastAsked.set(ctx, now);
  send(ctx, "ask", { at: now }, owner);
  return true;
}

export const canAskAgainIn = (ctx: Ctx): number =>
  Math.max(0, (lastAsked.get(ctx) ?? -Infinity) + ASK_EVERY_MS - Date.now());

export function onAsk(ctx: Ctx, from: string): void {
  if (!amOwner(ctx) || canBuild(ctx, from)) return;
  let m = heard.get(ctx);
  if (!m) heard.set(ctx, (m = new Map()));
  const now = Date.now();
  if (now - (m.get(from) ?? -Infinity) < ASK_EVERY_MS) return;
  m.set(from, now);
  const name = ctx.net.peers.get(from)?.name || "Someone";
  ctx.deps.bus.emit("room:ask", { id: from, name });
}
