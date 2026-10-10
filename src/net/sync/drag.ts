/**
 * Objects being dragged right now: transforms only, a few times a second, so others see the move as it happens.
 * The drop itself is an ordinary edit (objects.ts).
 */
import type { Ctx } from "../context";
import { inRoom, quietly, send } from "../context";
import type { Transform } from "../messages";
import { canBuild } from "../rules";
import { asRecord, cleanList, cleanTransform } from "../sanitize";

const SEND_EVERY_MS = 70;
const MAX_DRAGGED = 500;

interface Pending {
  ids: string[];
  timer: ReturnType<typeof setTimeout> | null;
}
const pending = new WeakMap<Ctx, Pending>();

function pendingOf(ctx: Ctx): Pending {
  let p = pending.get(ctx);
  if (!p) pending.set(ctx, (p = { ids: [], timer: null }));
  return p;
}

/** objects are being dragged here: send where they are now and then */
export function onLocalDrag(ctx: Ctx, ids: string[]): void {
  if (ctx.applyingRemote || !inRoom(ctx) || !ctx.net.synced) return;
  const p = pendingOf(ctx);
  p.ids = ids;
  if (!p.timer) p.timer = setTimeout(() => sendDrag(ctx), SEND_EVERY_MS);
}

function sendDrag(ctx: Ctx): void {
  const p = pendingOf(ctx);
  p.timer = null;
  const store = ctx.deps.store;
  // in element modes the mesh changes, which only the drop carries
  if (!inRoom(ctx) || store.selection.mode !== "object") return;
  const objs: Transform[] = [];
  for (const id of p.ids) {
    const o = store.byId(id);
    if (o) objs.push({ id: o.id, pos: o.pos, quat: o.quat, size: o.size });
  }
  if (objs.length) send(ctx, "xf", { objs });
}

export function onDrag(ctx: Ctx, raw: unknown, from: string): void {
  if (!ctx.net.synced || !canBuild(ctx, from)) return;
  const store = ctx.deps.store;
  const moves = cleanList(asRecord(raw).objs, MAX_DRAGGED)
    .map(cleanTransform)
    .filter((t): t is Transform => !!t && !!store.byId(t.id));
  if (!moves.length) return;
  quietly(ctx, () => {
    for (const t of moves) Object.assign(store.byId(t.id)!, { pos: t.pos, quat: t.quat, size: t.size });
    ctx.deps.commands.dragging(moves.map((t) => t.id));
  });
}
