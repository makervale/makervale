/**
 * The whole scene for a newcomer. The synced peer with the smallest id (the authority) sends it; the newcomer's own
 * scene is replaced and its history cleared, so an undo can't push the old scene into the room.
 */
import type { World } from "@/world/model";
import type { Ctx } from "../context";
import { changed, quietly, send, sendHello, system } from "../context";
import { acceptRules, banned } from "../rules";
import { asRecord, cleanNum, cleanText, sanitizeObjects } from "../sanitize";
import { MAX_OBJECTS, saveRoom } from "../saved-rooms";
import { settledWorld } from "./settled";

/** room versions and sequence numbers are counters; anything past this is nonsense */
export const MAX_COUNTER = 1e12;
/** a newcomer's next object ids start well past the room's, so two newcomers rarely pick the same ones */
const SEQ_GAP = 1000;
const SEQ_SPREAD = 1e6;

export function sendSnapshot(ctx: Ctx, pid: string): void {
  if (banned(ctx, pid)) return;
  const n = ctx.net;
  const snap = {
    world: settledWorld(ctx),
    room: n.name,
    pub: n.isPublic,
    adv: n.advertiser,
    ver: n.ver,
    rules: n.rules,
  };
  send(ctx, "snap", snap, pid);
}

/** replace the scene without echoing it into the room: no history, no selection, no running scripts */
export function loadWorld(ctx: Ctx, world: World): void {
  const { commands, bus, scripts } = ctx.deps;
  quietly(ctx, () => commands.replaceWorld({ seq: Math.max(1, world.seq), objects: world.objects }, "", false));
  scripts.reset();
  bus.emit("history:changed", { entry: null });
}

function takeRoomInfo(ctx: Ctx, d: Record<string, unknown>): void {
  const n = ctx.net;
  if (typeof d.room === "string") n.name = cleanText(d.room, 60) || n.name;
  n.isPublic = !!d.pub;
  n.advertiser = typeof d.adv === "string" ? d.adv : "";
}

export function onSnap(ctx: Ctx, raw: unknown): void {
  const d = asRecord(raw);
  const world = asRecord(d.world);
  const n = ctx.net;
  if (n.synced || !Array.isArray(world.objects)) return;
  if (d.rules) void acceptRules(ctx, d.rules);
  const objects = sanitizeObjects(world.objects, MAX_OBJECTS);
  const seq = Math.floor(cleanNum(world.seq, 1, MAX_COUNTER) || 1);
  loadWorld(ctx, { objects, seq: seq + SEQ_GAP + Math.floor(Math.random() * SEQ_SPREAD) });
  n.synced = true;
  n.fresh = false;
  n.ver = Math.max(n.ver, cleanNum(d.ver, 0, MAX_COUNTER) || 0);
  takeRoomInfo(ctx, d);
  sendHello(ctx);
  system(ctx, `You joined "${n.name}" (${objects.length} objects)`);
  void saveRoom(ctx);
  ctx.deps.scripts.resync();
  changed(ctx);
}
