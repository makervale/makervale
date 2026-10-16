/**
 * People coming and going. Everyone says hello on joining (and again whenever their name, look or knowledge of the
 * room changes). A hello tells us who someone is, whether they have the room's scene, and which copy of the room.
 */
import { cleanLook } from "@/avatar/look";
import type { Look } from "@/avatar/look";
import type { Ctx } from "../context";
import { authorityId, changed, sendHello, system } from "../context";
import { checkPerson } from "../person";
import { acceptRules, amOwner, banned, dropPeer } from "../rules";
import { asRecord, cleanNum, cleanText } from "../sanitize";
import type { PeerState } from "../state";
import { kindOf, newPeer } from "../state";
import { keepMyVersion } from "../copies";
import { sendAvatar } from "./avatars";
import { MAX_COUNTER, sendSnapshot } from "./snapshot";

export function onPeerJoin(ctx: Ctx, pid: string): void {
  if (banned(ctx, pid)) {
    dropPeer(ctx, pid);
    return;
  }
  if (!ctx.net.peers.has(pid)) ctx.net.peers.set(pid, newPeer(pid));
  sendHello(ctx, pid);
  sendAvatar(ctx, pid);
  changed(ctx);
}

export function onPeerLeave(ctx: Ctx, pid: string): void {
  const p = ctx.net.peers.get(pid);
  if (!p) return;
  ctx.deps.peers.remove(pid);
  ctx.net.peers.delete(pid);
  system(ctx, p.name + " left");
  if (ownerLeftPublicRoom(ctx, pid)) return;
  ctx.deps.scripts.resync();
  changed(ctx);
}

/** a public room lives only while its owner is in it: when they go, everyone goes */
function ownerLeftPublicRoom(ctx: Ctx, pid: string): boolean {
  const n = ctx.net;
  if (kindOf(n) !== "public" || pid !== n.rules?.host || amOwner(ctx)) return false;
  ctx.deps.commands.notice("The owner left, so their public room closed. Your own scene is back.");
  void ctx.leave();
  return true;
}

const sameLook = (a: Look, b: Look): boolean => JSON.stringify(a) === JSON.stringify(b);

/** keep the peer's body in step with their name and look */
function updateBody(ctx: Ctx, p: PeerState, wasName: string, look: Look): void {
  const bodies = ctx.deps.peers;
  if (!wasName || !sameLook(look, p.look)) bodies.create(p.id, p.name, look);
  else if (wasName !== p.name) bodies.rename(p.id, p.name);
}

/** a newcomer learns the room's name from anyone who has the scene */
function learnRoom(ctx: Ctx, d: Record<string, unknown>): void {
  const n = ctx.net;
  if (n.synced || !d.synced) return;
  if (typeof d.room === "string" && d.room) n.name = cleanText(d.room, 60);
}

/** their key for this room, and the visit key only they may sign relay messages with */
function learnKeys(ctx: Ctx, p: PeerState, d: Record<string, unknown>): void {
  const person = checkPerson(ctx.net.id, p.id, d);
  if (!person) return;
  p.person = person;
  if (ctx.link?.routeOf(p.id) === "direct") ctx.link.knowVisitKey(p.id, d.vk as string);
}

/**
 * Our copy was just reopened from disk and meets someone else's. A live copy (someone who stayed in the room) always
 * wins: it has everything that happened while we were away, whatever the counters say (they are per browser and
 * drift apart). Between two reopened copies the higher version wins, ties go to the smaller id.
 */
function yieldToBetterCopy(ctx: Ctx, p: PeerState): void {
  const n = ctx.net;
  if (!n.synced || !p.synced || !n.fresh) return;
  const live = !p.fresh;
  const newer = p.ver > n.ver || (p.ver === n.ver && p.id < n.selfId);
  if (!live && !newer) return;
  keepMyVersion(ctx);
  n.synced = false;
  ctx.deps.scripts.reset();
  sendHello(ctx);
  system(ctx, p.name + (live ? " is in the room now" : " has a newer copy") + "; getting the current scene…");
}

export function onHello(ctx: Ctx, raw: unknown, pid: string): void {
  const d = asRecord(raw);
  const n = ctx.net;
  const p = n.peers.get(pid) ?? newPeer(pid);
  n.peers.set(pid, p);
  const wasName = p.name;
  p.name = cleanText(d.name, 32) || "Someone";
  const look = cleanLook(d.look);
  updateBody(ctx, p, wasName, look);
  p.look = look;
  p.color = look.shirt;
  p.synced = !!d.synced;
  p.ver = cleanNum(d.ver, 0, MAX_COUNTER) || 0;
  p.fresh = d.fresh === true;
  learnKeys(ctx, p, d);
  if (banned(ctx, pid)) return dropPeer(ctx, pid);
  if (d.rules) void acceptRules(ctx, d.rules);
  if (!wasName) system(ctx, p.name + " is here");
  learnRoom(ctx, d);
  yieldToBetterCopy(ctx, p);
  // the synced peer with the smallest id answers a newcomer with the scene
  if (n.synced && !p.synced && authorityId(ctx) === n.selfId) sendSnapshot(ctx, pid);
  ctx.deps.scripts.resync();
  changed(ctx);
}
