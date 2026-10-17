/**
 * Edits. Whatever a local action touched goes to everyone, batched for a moment: changed objects in full, deleted
 * ones by id, and the scene order. The last change to an object wins. Edits from people who may not build are
 * dropped, except the authority's script results on objects that already run that script. Whether an edit keeps
 * to the laws of space only the authority judges; the others take its verdict.
 */
import type { Obj, World } from "@/world/model";
import { upsert } from "@/world/model";
import type { Ctx } from "../context";
import { amAuthority, applyRemote, authorityId, inRoom } from "../context";
import { recordLocal, recordRemote } from "../moderation";
import { canBuild } from "../rights";
import { asRecord, cleanList, cleanNum, sanitizeObj, sanitizeObjects, validId } from "../sanitize";
import { endDrags, putBackDragged } from "./drag";
import { queueObjs, sendObjs } from "./outbox";
import { hearVerdict, verdictIn } from "./verdict";
import { MAX_COUNTER } from "./snapshot";

const MAX_EDITS = 5000;
const MAX_SCRIPT_EDITS = 500;

/** objects the authority refused lately, and when */
const refusals = new WeakMap<Ctx, Map<string, number>>();
const REFUSED_MS = 10_000;

function refusalsOf(ctx: Ctx): Map<string, number> {
  let m = refusals.get(ctx);
  if (!m) refusals.set(ctx, (m = new Map()));
  return m;
}

/** the scene changed here (a user action, undo, redo): count it and send it, unless it came from the room */
export function onLocalEdit(ctx: Ctx, ids: string[] | undefined, reverted = false): void {
  if (ctx.applyingRemote || !inRoom(ctx) || !ids) return;
  const n = ctx.net;
  if (n.synced) {
    n.ver++;
    n.fresh = false;
    // nobody else here to receive it: until someone does (or the relays do), this change is ours alone
    if (![...n.peers.values()].some((p) => p.synced)) n.pending = true;
  }
  // a cancelled or refused action changed nothing in the end: the owner isn't the last to change those objects
  if (!reverted) recordLocal(ctx, ids);
  endDrags(ctx, ids);
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

/** objects the peer deleted are gone from the selection too */
function fixSelection(ctx: Ctx): void {
  const { store, commands } = ctx.deps;
  const sel = store.selection;
  const kept = [...sel.objects].filter((id) => store.byId(id));
  if (kept.length !== sel.objects.size || (sel.mode !== "object" && !kept.length)) commands.selectObjects(kept);
}

/**
 * Only the authority judges the laws of space, so two edits made at once can't be refused on one screen and taken
 * on another. A refused edit is answered with the authority's own copy of what it touched, to everyone: the verdict
 * (verdict.ts).
 */
function judged(ctx: Ctx, set: Obj[], del: string[], from: string): boolean {
  if (!amAuthority(ctx)) return true;
  const v = ctx.deps.commands.space.checkIncoming(set, del);
  if (v.ok) return true;
  const touched = [...new Set([...del, ...set.map((o) => o.id)])];
  putBackDragged(ctx, touched);
  endDrags(ctx, touched);
  sendObjs(ctx, touched, { verdict: { to: from, why: v.why } });
  for (const id of touched) refusalsOf(ctx).set(id, Date.now());
  return false;
}

/**
 * The authority took an edit of objects it refused a moment ago. Its verdict may reach someone after this edit
 * (they come from different peers) and undo it there, so its copy goes out again, after the verdict.
 */
function againAfterVerdict(ctx: Ctx, ids: string[]): void {
  if (!amAuthority(ctx)) return;
  const m = refusalsOf(ctx);
  const since = Date.now() - REFUSED_MS;
  for (const [id, at] of m) if (at < since) m.delete(id);
  const again = ids.filter((id) => m.has(id));
  if (again.length) sendObjs(ctx, again);
}

export function onObjs(ctx: Ctx, raw: unknown, from: string): void {
  const d = asRecord(raw);
  if (!ctx.net.synced || !raw) return;
  if (d.s === 1) return onScriptEdits(ctx, d, from);
  const verdict = verdictIn(ctx, d, from);
  if (!verdict && !canBuild(ctx, from)) return;
  const store = ctx.deps.store;
  // each object once: set or deleted, never both, so none is counted out of the laws twice
  const set = [...new Map(sanitizeObjects(d.set, MAX_EDITS).map((o) => [o.id, o])).values()];
  const setIds = new Set(set.map((o) => o.id));
  const del = [...new Set(cleanList(d.del, MAX_EDITS))].filter(
    (id): id is string => validId(id) && !!store.byId(id) && !setIds.has(id),
  );
  if (!verdict && !judged(ctx, set, del, from)) return;
  recordRemote(ctx, from, set, del);
  take(ctx, d, set, del);
  if (verdict) hearVerdict(ctx, verdict);
  else againAfterVerdict(ctx, [...setIds, ...del]);
}

function take(ctx: Ctx, d: Record<string, unknown>, set: Obj[], del: string[]): void {
  const store = ctx.deps.store;
  const touched = [...del, ...set.map((o) => o.id)];
  const change = () => {
    upsert(store.world, set, del);
    reorder(store.world, d.order);
  };
  if (touched.length) applyRemote(ctx, touched, change);
  else reorder(store.world, d.order);
  endDrags(ctx, touched);
  ctx.net.ver = Math.max(ctx.net.ver + 1, cleanNum(d.ver, 0, MAX_COUNTER) || 0);
  ctx.net.fresh = false;
  if (touched.length) fixSelection(ctx);
}

/** a script may change an object's transform, colours and state, not its script or its shape */
function scriptMayChange(cur: Obj | undefined, next: Obj): cur is Obj {
  if (!cur?.script || cur.script !== next.script) return false;
  return cur.mesh.v.length === next.mesh.v.length && cur.mesh.f.length === next.mesh.f.length;
}

/**
 * What scripts changed. They run on the authority only and change only their own object's transform, colours and
 * state, so that is all a script edit may do, whoever sends it; and it is nobody's edit, so it isn't logged.
 */
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
