/**
 * What goes out of this computer's scene into the room: whatever changed, batched for a moment, changed objects in
 * full, deleted ones by id, and the scene order. Scripts' results go apart, marked as theirs (objects.ts).
 */
import type { Obj } from "@/world/model";
import type { Ctx } from "../context";
import { inRoom, send } from "../context";
import { settled } from "./settled";

const FLUSH_MS = 60;

interface Outbox {
  dirty: Set<string>;
  /** of those, the ones only scripts changed */
  scripted: Set<string>;
  timer: ReturnType<typeof setTimeout> | null;
}
const outboxes = new WeakMap<Ctx, Outbox>();

function outboxOf(ctx: Ctx): Outbox {
  let box = outboxes.get(ctx);
  if (!box) outboxes.set(ctx, (box = { dirty: new Set(), scripted: new Set(), timer: null }));
  return box;
}

/** send these objects (or their deletion) to the room soon */
export function queueObjs(ctx: Ctx, ids: Iterable<string>, byScript = false): void {
  if (!inRoom(ctx) || !ctx.net.synced) return;
  const box = outboxOf(ctx);
  for (const id of ids) {
    if (byScript && !box.dirty.has(id)) box.scripted.add(id);
    else if (!byScript) box.scripted.delete(id);
    box.dirty.add(id);
  }
  if (!box.timer) box.timer = setTimeout(() => flushObjs(ctx), FLUSH_MS);
}

/** leaving: nothing queued goes anywhere */
export function dropQueuedObjs(ctx: Ctx): void {
  const box = outboxOf(ctx);
  if (box.timer) clearTimeout(box.timer);
  box.timer = null;
  box.dirty.clear();
  box.scripted.clear();
}

function flushObjs(ctx: Ctx): void {
  const box = outboxOf(ctx);
  const ids = [...box.dirty];
  const scripted = new Set(box.scripted);
  box.timer = null;
  box.dirty.clear();
  box.scripted.clear();
  if (!inRoom(ctx)) return;
  sendObjs(
    ctx,
    ids.filter((id) => !scripted.has(id)),
  );
  sendObjs(ctx, [...scripted], { s: 1 });
}

export function sendObjs(ctx: Ctx, ids: string[], extra: Record<string, unknown> = {}): void {
  const store = ctx.deps.store;
  const set: Obj[] = [];
  const del: string[] = [];
  for (const id of ids) {
    const o = store.byId(id);
    if (o) set.push(settled(ctx, o));
    else del.push(id);
  }
  const order = store.world.objects.map((o) => o.id);
  if (set.length || del.length) send(ctx, "objs", { set, del, order, ver: ctx.net.ver, ...extra });
}
