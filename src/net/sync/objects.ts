/**
 * Edits. Whatever a local action touched goes to everyone, batched for a moment: changed objects in full, deleted
 * ones by id, and the scene order. The last change to an object wins. Edits from people who may not build are
 * dropped, except the authority's script results on objects that already run that script.
 */
import type { Obj, World } from "@/world/model";
import { refreshListing } from "../advertising";
import type { Ctx } from "../context";
import { applyRemote, authorityId, inRoom, send } from "../context";
import { canBuild } from "../rules";
import { asRecord, cleanList, cleanNum, sanitizeObj, sanitizeObjects, validId } from "../sanitize";
import { settled } from "./settled";
import { MAX_COUNTER } from "./snapshot";

const FLUSH_MS = 60;
const MAX_EDITS = 5000;
const MAX_SCRIPT_EDITS = 500;

interface Outbox {
  dirty: Set<string>;
  timer: ReturnType<typeof setTimeout> | null;
}
const outboxes = new WeakMap<Ctx, Outbox>();

function outboxOf(ctx: Ctx): Outbox {
  let box = outboxes.get(ctx);
  if (!box) outboxes.set(ctx, (box = { dirty: new Set(), timer: null }));
  return box;
}

/** send these objects (or their deletion) to the room soon */
export function queueObjs(ctx: Ctx, ids: Iterable<string>): void {
  if (!inRoom(ctx) || !ctx.net.synced) return;
  const box = outboxOf(ctx);
  for (const id of ids) box.dirty.add(id);
  if (!box.timer) box.timer = setTimeout(() => flushObjs(ctx), FLUSH_MS);
}

/** leaving: nothing queued goes anywhere */
export function dropQueuedObjs(ctx: Ctx): void {
  const box = outboxOf(ctx);
  if (box.timer) clearTimeout(box.timer);
  box.timer = null;
  box.dirty.clear();
}

function flushObjs(ctx: Ctx): void {
  const box = outboxOf(ctx);
  const ids = [...box.dirty];
  box.timer = null;
  box.dirty.clear();
  if (!inRoom(ctx)) return;
  const store = ctx.deps.store;
  const set: Obj[] = [];
  const del: string[] = [];
  for (const id of ids) {
    const o = store.byId(id);
    if (o) set.push(settled(ctx, o));
    else del.push(id);
  }
  const order = store.world.objects.map((o) => o.id);
  if (set.length || del.length) send(ctx, "objs", { set, del, order, ver: ctx.net.ver });
  refreshListing(ctx);
}

/** the scene changed here (a user action, undo, redo): count it and send it, unless it came from the room */
export function onLocalEdit(ctx: Ctx, ids: string[] | undefined): void {
  if (ctx.applyingRemote || !inRoom(ctx) || !ids) return;
  if (ctx.net.synced) {
    ctx.net.ver++;
    ctx.net.fresh = false;
  }
  queueObjs(ctx, ids);
}

/** put the scene in the sender's order, if it lists exactly our objects */
function reorder(world: World, order: unknown): void {
  if (!Array.isArray(order) || order.length !== world.objects.length) return;
  const at = new Map<string, number>();
  order.forEach((id: unknown, k) => {
    if (typeof id === "string") at.set(id, k);
  });
  if (world.objects.every((o) => at.has(o.id))) world.objects.sort((a, b) => at.get(a.id)! - at.get(b.id)!);
}

function upsert(world: World, set: Obj[], del: string[]): void {
  world.objects = world.objects.filter((o) => !del.includes(o.id));
  for (const o of set) {
    const i = world.objects.findIndex((x) => x.id === o.id);
    if (i >= 0) world.objects[i] = o;
    else world.objects.push(o);
  }
}

/** objects the peer deleted are gone from the selection too */
function fixSelection(ctx: Ctx): void {
  const { store, commands } = ctx.deps;
  const sel = store.selection;
  const kept = [...sel.objects].filter((id) => store.byId(id));
  if (kept.length !== sel.objects.size || (sel.mode !== "object" && !kept.length)) commands.selectObjects(kept);
}

export function onObjs(ctx: Ctx, raw: unknown, from: string): void {
  const d = asRecord(raw);
  if (!ctx.net.synced || !raw) return;
  if (!canBuild(ctx, from)) {
    onScriptEdits(ctx, d, from);
    return;
  }
  const store = ctx.deps.store;
  const del = cleanList(d.del, MAX_EDITS).filter((id): id is string => validId(id) && !!store.byId(id));
  const set = sanitizeObjects(d.set, MAX_EDITS);
  const touched = [...del, ...set.map((o) => o.id)];
  const change = () => {
    upsert(store.world, set, del);
    reorder(store.world, d.order);
  };
  if (touched.length) applyRemote(ctx, touched, change);
  else reorder(store.world, d.order);
  ctx.net.ver = Math.max(ctx.net.ver + 1, cleanNum(d.ver, 0, MAX_COUNTER) || 0);
  ctx.net.fresh = false;
  if (touched.length) fixSelection(ctx);
}

/** a script may change an object's transform, colours and state, not its script or its shape */
function scriptMayChange(cur: Obj | undefined, next: Obj): cur is Obj {
  if (!cur?.script || cur.script !== next.script) return false;
  return cur.mesh.v.length === next.mesh.v.length && cur.mesh.f.length === next.mesh.f.length;
}

/** only the host may build: the authority's scripts may still update scripted objects */
function onScriptEdits(ctx: Ctx, d: Record<string, unknown>, from: string): void {
  if (from !== authorityId(ctx)) return;
  const store = ctx.deps.store;
  const updates: Obj[] = [];
  for (const x of cleanList(d.set, MAX_SCRIPT_EDITS)) {
    const o = sanitizeObj(x);
    const cur = o ? store.byId(o.id) : undefined;
    if (o && scriptMayChange(cur, o)) updates.push({ ...o, mesh: cur.mesh });
  }
  if (!updates.length) return;
  applyRemote(
    ctx,
    updates.map((o) => o.id),
    () => upsert(store.world, updates, []),
  );
}
