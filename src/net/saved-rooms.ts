/**
 * Your rooms, kept in this browser (IndexedDB): every private room you were in, and the rooms you own. A copy has a
 * version number that grows with every change. Reopen a private room alone and your copy becomes the room; meet
 * someone with a newer copy and theirs wins (sync/hello.ts). A guest keeps no copy of someone else's public room:
 * it exists only while its owner is in it.
 */
import { readStored, removeStored, storedKeys, writeStored } from "@/app/storage";
import type { RoomKind, Rules } from "@/lib/rules";
import type { World } from "@/world/model";
import { restingWorld } from "@/world/resting";
import type { Ctx } from "./context";
import { inRoom } from "./context";
import { cleanNum, cleanText, sanitizeObjects } from "./sanitize";
import { kindOf } from "./state";

/** where a copy came from: a room, or a world in the Gallery (title and version) */
export interface Origin {
  title: string;
  /** "" for a room */
  version: string;
}

export interface SavedRoom {
  id: string;
  name: string;
  ver: number;
  savedAt: number;
  world: World;
  rules: Rules | null;
  /** it has changes nobody else has (see NetState.pending) */
  pending: boolean;
  basedOn: Origin | null;
}

export interface SavedRoomInfo {
  id: string;
  name: string;
  kind: RoomKind;
  objects: number;
  savedAt: number;
  /** this browser owns the room */
  owned: boolean;
  keep: boolean;
  basedOn: Origin | null;
}

const SAVE_DELAY_S = 2;
export const MAX_OBJECTS = 5000;

interface SaveTimer {
  savedVer: number;
  /** seconds until the next save; negative when none is due */
  dueIn: number;
}
const timers = new WeakMap<Ctx, SaveTimer>();
const origins = new WeakMap<Ctx, Origin | null>();

function timerOf(ctx: Ctx): SaveTimer {
  let t = timers.get(ctx);
  if (!t) timers.set(ctx, (t = { savedVer: -1, dueIn: -1 }));
  return t;
}

export const setOrigin = (ctx: Ctx, origin: Origin | null): void => void origins.set(ctx, origin);

const mayKeep = (ctx: Ctx): boolean => kindOf(ctx.net) === "private" || ctx.rules.ownsRules(ctx.net.rules);

export async function saveRoom(ctx: Ctx): Promise<void> {
  const n = ctx.net;
  if (!inRoom(ctx) || !n.synced || !n.id || !mayKeep(ctx)) return;
  const t = timerOf(ctx);
  t.savedVer = n.ver;
  t.dueIn = -1;
  // a deep copy: the memory fallback of storage keeps the value itself
  const world = structuredClone(restingWorld(ctx.deps.store.world));
  const basedOn = origins.get(ctx) ?? null;
  const rec: SavedRoom = {
    id: n.id,
    name: n.name,
    ver: n.ver,
    savedAt: Date.now(),
    rules: n.rules,
    world,
    basedOn,
    pending: n.pending,
  };
  await writeStored("rooms", n.id, rec);
}

/** a room's copy that isn't the room we are in (your version of a room, a copy to open later) */
export const storeRoomCopy = (rec: SavedRoom): Promise<void> => writeStored("rooms", rec.id, rec);

/** per frame: save a little after the room's version moved */
export function saveTick(ctx: Ctx, dt: number): void {
  if (!inRoom(ctx) || !ctx.net.synced) return;
  const t = timerOf(ctx);
  if (ctx.net.ver !== t.savedVer && t.dueIn < 0) t.dueIn = SAVE_DELAY_S;
  if (t.dueIn < 0) return;
  t.dueIn -= dt;
  if (t.dueIn < 0) void saveRoom(ctx);
}

function cleanOrigin(x: unknown): Origin | null {
  if (!x || typeof x !== "object") return null;
  const o = x as Record<string, unknown>;
  return { title: cleanText(o.title, 60), version: cleanText(o.version, 12) };
}

/** checked like anything from a peer: it may come from an older version of the app */
export async function readSavedRoom(id: string): Promise<SavedRoom | null> {
  const r = await readStored<Partial<SavedRoom>>("rooms", id);
  if (!r || !r.world || !Array.isArray(r.world.objects)) return null;
  return {
    id,
    name: cleanText(r.name, 60) || "Room",
    ver: cleanNum(r.ver, 0, 1e12) ?? 0,
    savedAt: cleanNum(r.savedAt, 0, 1e15) ?? 0,
    world: { seq: cleanNum(r.world.seq, 1, 1e12) ?? 1, objects: sanitizeObjects(r.world.objects, MAX_OBJECTS) },
    rules: r.rules ?? null,
    pending: r.pending === true,
    basedOn: cleanOrigin(r.basedOn),
  };
}

export async function savedRooms(owns: (r: Rules | null) => boolean): Promise<SavedRoomInfo[]> {
  const out: SavedRoomInfo[] = [];
  for (const key of await storedKeys("rooms")) {
    const r = await readSavedRoom(String(key));
    if (!r) continue;
    const rules = r.rules;
    const kind = rules?.kind === "public" ? "public" : "private";
    const info = { id: r.id, name: r.name, objects: r.world.objects.length, savedAt: r.savedAt, basedOn: r.basedOn };
    out.push({ ...info, kind, owned: owns(rules), keep: !!rules?.keep });
  }
  return out.sort((a, b) => b.savedAt - a.savedAt);
}

export const forgetRoom = (id: string): Promise<void> => removeStored("rooms", id);
