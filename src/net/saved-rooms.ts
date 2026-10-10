/**
 * Rooms persist without a server: everyone keeps a copy of each room they were in (IndexedDB), with a version number
 * that grows with every change. Reopen a room alone and your copy becomes the room; meet someone with a newer copy and
 * theirs wins (see sync/hello.ts).
 */
import { readStored, removeStored, storedKeys, writeStored } from "@/app/storage";
import type { Rules } from "@/lib/rules";
import type { World } from "@/world/model";
import type { Ctx } from "./context";
import { inRoom } from "./context";
import { cleanNum, cleanText, sanitizeObjects } from "./sanitize";
import { restingWorld } from "@/world/resting";

export interface SavedRoom {
  id: string;
  name: string;
  pub: boolean;
  ver: number;
  savedAt: number;
  world: World;
  rules?: Rules | null;
}

export interface SavedRoomInfo {
  id: string;
  name: string;
  objects: number;
  savedAt: number;
  pub: boolean;
}

/** a burst of edits is saved once, this long after it started */
const SAVE_DELAY_S = 2;
export const MAX_OBJECTS = 5000;

interface SaveTimer {
  savedVer: number;
  /** seconds until the next save; negative when none is due */
  dueIn: number;
}
const timers = new WeakMap<Ctx, SaveTimer>();

function timerOf(ctx: Ctx): SaveTimer {
  let t = timers.get(ctx);
  if (!t) timers.set(ctx, (t = { savedVer: -1, dueIn: -1 }));
  return t;
}

export async function saveRoom(ctx: Ctx): Promise<void> {
  const n = ctx.net;
  if (!inRoom(ctx) || !n.synced || !n.id) return;
  const t = timerOf(ctx);
  t.savedVer = n.ver;
  t.dueIn = -1;
  // a deep copy: the memory fallback of storage keeps the value itself
  const world = structuredClone(restingWorld(ctx.deps.store.world));
  const rec: SavedRoom = {
    id: n.id,
    name: n.name,
    pub: n.isPublic,
    ver: n.ver,
    savedAt: Date.now(),
    rules: n.rules,
    world,
  };
  await writeStored("rooms", n.id, rec);
}

/** per frame: save a little after the room's version moved */
export function saveTick(ctx: Ctx, dt: number): void {
  if (!inRoom(ctx) || !ctx.net.synced) return;
  const t = timerOf(ctx);
  if (ctx.net.ver !== t.savedVer && t.dueIn < 0) t.dueIn = SAVE_DELAY_S;
  if (t.dueIn < 0) return;
  t.dueIn -= dt;
  if (t.dueIn < 0) void saveRoom(ctx);
}

/** our copy of a room, checked like anything from a peer (it may come from an older version of the app) */
export async function readSavedRoom(id: string): Promise<SavedRoom | null> {
  const r = await readStored<Partial<SavedRoom>>("rooms", id);
  if (!r || !r.world || !Array.isArray(r.world.objects)) return null;
  return {
    id,
    name: cleanText(r.name, 60) || "Room " + id,
    pub: !!r.pub,
    ver: cleanNum(r.ver, 0, 1e12) ?? 0,
    savedAt: cleanNum(r.savedAt, 0, 1e15) ?? 0,
    world: { seq: cleanNum(r.world.seq, 1, 1e12) ?? 1, objects: sanitizeObjects(r.world.objects, MAX_OBJECTS) },
    rules: r.rules ?? null,
  };
}

export async function savedRooms(): Promise<SavedRoomInfo[]> {
  const out: SavedRoomInfo[] = [];
  for (const key of await storedKeys("rooms")) {
    const r = await readStored<SavedRoom>("rooms", key);
    if (!r || !r.world || !Array.isArray(r.world.objects)) continue;
    out.push({ id: r.id, name: r.name, objects: r.world.objects.length, savedAt: r.savedAt, pub: r.pub });
  }
  return out.sort((a, b) => b.savedAt - a.savedAt);
}

export const forgetRoom = (id: string): Promise<void> => removeStored("rooms", id);
