/**
 * Listing a room publicly. One peer at a time does it (the "advertiser"); when it leaves, the script authority takes
 * over, so a public room stays listed as long as anyone is in it.
 */
import { advertise, refreshAd, stopAdvertising as withdrawAd } from "./discovery";
import { answerPings, stopAnswering } from "./reachability";
import type { Ctx } from "./context";
import { authorityId, changed, sendHello, system } from "./context";

export const amAdvertiser = (ctx: Ctx): boolean => ctx.net.advertiser === ctx.net.selfId;

export function startAdvertising(ctx: Ctx): void {
  const n = ctx.net;
  n.advertiser = n.selfId;
  answerPings(n.id);
  advertise(n.id, () => ({
    name: n.name,
    host: ctx.deps.selfName(),
    people: n.peers.size + 1,
    objects: ctx.deps.store.world.objects.length,
  }));
}

/** taking the room off the public list also stops answering reachability pings */
export function stopAdvertising(): void {
  withdrawAd();
  stopAnswering();
}

/** the listing shows people and objects: refresh it when they change, if it's ours */
export function refreshListing(ctx: Ctx): void {
  if (amAdvertiser(ctx)) refreshAd();
}

/** the advertiser left: the authority lists the room from now on */
export function takeOverAdvertising(ctx: Ctx): void {
  if (!ctx.net.isPublic || !ctx.net.synced) return;
  const next = authorityId(ctx);
  if (next !== ctx.net.selfId) {
    ctx.net.advertiser = next;
    return;
  }
  startAdvertising(ctx);
  sendHello(ctx);
  system(ctx, "The room stays listed publicly from your computer now.");
}

export function setPublic(ctx: Ctx, listed: boolean): void {
  ctx.net.isPublic = listed;
  if (listed) startAdvertising(ctx);
  else if (amAdvertiser(ctx)) {
    stopAdvertising();
    ctx.net.advertiser = "";
  }
  sendHello(ctx);
  changed(ctx);
}
