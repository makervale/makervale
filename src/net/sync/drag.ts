/**
 * Objects being dragged right now: transforms only, a few times a second, so others see the move as it happens.
 * The drop itself is an ordinary edit (objects.ts).
 */
import type { Obj } from "@/world/model";
import { upsert } from "@/world/model";
import type { Ctx } from "../context";
import { amAuthority, applyRemote, inRoom, quietly, send } from "../context";
import type { Transform } from "../messages";
import { canBuild } from "../rights";
import { asRecord, cleanList, cleanTransform } from "../sanitize";
import { queueObjs } from "./outbox";

const SEND_EVERY_MS = 70;
const MAX_DRAGGED = 500;

interface Pending {
  ids: string[];
  timer: ReturnType<typeof setTimeout> | null;
}
const pending = new WeakMap<Ctx, Pending>();
/** objects peers are dragging, as they were before the first move (what the drop's edit really changes), and who */
const starts = new WeakMap<Ctx, Map<string, { obj: Obj; by: string }>>();

function startsOf(ctx: Ctx): Map<string, { obj: Obj; by: string }> {
  let m = starts.get(ctx);
  if (!m) starts.set(ctx, (m = new Map()));
  return m;
}

/** where a peer's drag of this object started, if one is going on */
export const dragStart = (ctx: Ctx, id: string): Obj | undefined => startsOf(ctx).get(id)?.obj;

/** what this peer is dragging, as it was before; their drags end here (they left without dropping) */
function dragsBy(ctx: Ctx, pid: string): Obj[] {
  const m = startsOf(ctx);
  const out = [...m].filter(([, s]) => s.by === pid);
  for (const [id] of out) m.delete(id);
  return out.map(([, s]) => s.obj);
}

/** the drop arrived (applied or refused): these drags are over */
export function endDrags(ctx: Ctx, ids: Iterable<string>): void {
  const m = startsOf(ctx);
  for (const id of ids) m.delete(id);
}

/** a new room: no drag of the last one goes on */
export const resetDrags = (ctx: Ctx): boolean => starts.delete(ctx);

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
  const m = startsOf(ctx);
  for (const t of moves) if (!m.has(t.id)) m.set(t.id, { obj: structuredClone(store.byId(t.id)!), by: from });
  quietly(ctx, () => {
    for (const t of moves) Object.assign(store.byId(t.id)!, { pos: t.pos, quat: t.quat, size: t.size });
    ctx.deps.commands.dragging(moves.map((t) => t.id));
  });
}

function putBack(ctx: Ctx, back: Obj[]): void {
  if (!back.length) return;
  applyRemote(
    ctx,
    back.map((o) => o.id),
    () => upsert(ctx.deps.store.world, back, []),
  );
}

/**
 * Someone left in the middle of a drag: what they were dragging goes back to where the drag started. The authority
 * puts it back for everyone, as a screen that came in mid-drag never saw where the drag began.
 */
export function abandonDrags(ctx: Ctx, pid: string): void {
  const back = dragsBy(ctx, pid);
  if (!amAuthority(ctx)) return;
  putBack(ctx, back);
  queueObjs(
    ctx,
    back.map((o) => o.id),
  );
}

/** a refused drop: what the drag moved here goes back to where the drag started */
export function putBackDragged(ctx: Ctx, ids: string[]): void {
  putBack(
    ctx,
    ids.map((id) => dragStart(ctx, id)).filter((o): o is Obj => !!o),
  );
}
