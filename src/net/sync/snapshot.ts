/**
 * The whole scene for a newcomer. The authority (authority.ts) sends it; the newcomer's own
 * scene is replaced and its history cleared, so an undo can't push the old scene into the room.
 */
import type { World } from "@/world/model";
import type { Ctx } from "../context";
import { authorityId, changed, quietly, send, sendHello, system } from "../context";
import { acceptRules, banned } from "../rules";
import { asRecord, cleanNum, cleanText, sanitizeObjects } from "../sanitize";
import { MAX_OBJECTS, saveRoom } from "../saved-rooms";
import { saveVaultNow, vaultWriter } from "../vault";
import { settledWorld } from "./settled";

/** room versions and sequence numbers are counters; anything past this is nonsense */
export const MAX_COUNTER = 1e12;
/** a newcomer's next object ids start well past the room's, so two newcomers rarely pick the same ones */
const SEQ_GAP = 1000;
const SEQ_SPREAD = 1e6;

export function sendSnapshot(ctx: Ctx, pid: string): void {
  if (banned(ctx, pid)) return;
  const n = ctx.net;
  // whoever gets the scene from us has our changes: they are no longer ours alone
  n.pending = false;
  // reached only through the relays, in a room kept on them: they load the room's copy there, brought up to date
  // (much lighter on the relays than the snapshot in parts through the channel)
  if (ctx.link?.routeOf(pid) === "relay" && vaultWriter(ctx)) {
    void saveVaultNow(ctx).then(() => send(ctx, "vsnap", { ver: n.ver }, pid));
    return;
  }
  send(ctx, "snap", { world: settledWorld(ctx), room: n.name, ver: n.ver, rules: n.rules }, pid);
}

/** replace the scene without echoing it into the room: no history, no selection, no running scripts */
export function loadWorld(ctx: Ctx, world: World): void {
  const { commands, bus, scripts } = ctx.deps;
  quietly(ctx, () => commands.replaceWorld({ seq: Math.max(1, world.seq), objects: world.objects }, "", false));
  scripts.reset();
  bus.emit("history:changed", { entry: null });
}

/**
 * The scene is taken from the authority only, so no one else can hand a newcomer a scene of their own. Anyone
 * else's goes unheard, and the newcomer says hello again, so the authority (who may not have seen it yet) answers.
 */
export function fromAuthority(ctx: Ctx, from: string): boolean {
  if (from === authorityId(ctx)) return true;
  sendHello(ctx);
  return false;
}

function takeRoomInfo(ctx: Ctx, d: Record<string, unknown>): void {
  if (typeof d.room === "string") ctx.net.name = cleanText(d.room, 60) || ctx.net.name;
}

export async function onSnap(ctx: Ctx, raw: unknown, from: string): Promise<void> {
  const d = asRecord(raw);
  const world = asRecord(d.world);
  const n = ctx.net;
  const room = n.id;
  if (n.synced || !Array.isArray(world.objects)) return;
  // who may build decides who judges the room: know it before taking part
  if (d.rules) await acceptRules(ctx, d.rules);
  if (n.synced || n.id !== room) return;
  if (!fromAuthority(ctx, from)) return;
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
