/**
 * The owner's tools against damage: undo everything one person did this session (even after they left), and rewind
 * the whole scene a few minutes. Both are ordinary edits by the owner: they reach everyone, and Ctrl+Z undoes them.
 */
import type { Obj } from "@/world/model";
import type { Ctx } from "../context";
import { changed, inRoom } from "../context";
import { amOwner, personOf } from "../rules";
import type { Change } from "./edit-log";
import { EditLog, undoPlan } from "./edit-log";

const logs = new WeakMap<Ctx, EditLog>();
const names = new WeakMap<Ctx, Map<string, string>>();

function logOf(ctx: Ctx): EditLog {
  let log = logs.get(ctx);
  if (!log) logs.set(ctx, (log = new EditLog()));
  return log;
}

function namesOf(ctx: Ctx): Map<string, string> {
  let m = names.get(ctx);
  if (!m) names.set(ctx, (m = new Map()));
  return m;
}

/** a new room: nothing of the last one's log carries over */
export function resetModeration(ctx: Ctx): void {
  logs.delete(ctx);
  names.delete(ctx);
}

/** a peer's edit, about to be applied */
export function recordRemote(ctx: Ctx, from: string, set: Obj[], del: string[]): void {
  if (!amOwner(ctx)) return;
  const who = personOf(ctx, from);
  namesOf(ctx).set(who, ctx.net.peers.get(from)?.name || "Someone");
  const log = logOf(ctx);
  const store = ctx.deps.store;
  const at = Date.now();
  const before = (id: string) => structuredClone(store.byId(id) ?? null);
  for (const o of set) log.record({ at, who, id: o.id, before: before(o.id), after: structuredClone(o) });
  for (const id of del) log.record({ at, who, id, before: before(id), after: null });
}

export function moderationTick(ctx: Ctx): void {
  if (inRoom(ctx) && ctx.net.synced && amOwner(ctx)) logOf(ctx).checkpoint(Date.now(), () => ctx.deps.store.world);
}

export interface Changer {
  who: string;
  name: string;
  /** objects they changed this session */
  objects: number;
  /** their peer id while they are here; "" after they left */
  here: string;
}

export function changers(ctx: Ctx): Changer[] {
  const byWho = new Map<string, Set<string>>();
  for (const c of logOf(ctx).changes) {
    if (!byWho.has(c.who)) byWho.set(c.who, new Set());
    byWho.get(c.who)!.add(c.id);
  }
  const herePid = (who: string) => [...ctx.net.peers.keys()].find((pid) => personOf(ctx, pid) === who) ?? "";
  return [...byWho].map(([who, ids]) => ({
    who,
    name: namesOf(ctx).get(who) ?? "Someone",
    objects: ids.size,
    here: herePid(who),
  }));
}

/** set objects to these states (null: delete) as one undoable action of the owner */
function restore(ctx: Ctx, label: string, plan: Map<string, Obj | null>): number {
  if (!plan.size) return 0;
  const world = ctx.deps.store.world;
  ctx.deps.commands.act(label, plan.keys(), () => {
    for (const [id, o] of plan) {
      const i = world.objects.findIndex((x) => x.id === id);
      if (!o) {
        if (i >= 0) world.objects.splice(i, 1);
      } else if (i >= 0) world.objects[i] = structuredClone(o);
      else world.objects.push(structuredClone(o));
    }
  });
  changed(ctx);
  return plan.size;
}

/** resolves with how many objects changed back */
export function undoPerson(ctx: Ctx, who: string): number {
  if (!amOwner(ctx)) return 0;
  const store = ctx.deps.store;
  const name = namesOf(ctx).get(who) ?? "someone";
  return restore(
    ctx,
    `Undo ${name}'s changes`,
    undoPlan(logOf(ctx).changes, who, (id) => store.byId(id)),
  );
}

function rewindPlan(now: Obj[], then: Obj[]): Map<string, Obj | null> {
  const plan = new Map<string, Obj | null>();
  const before = new Map(then.map((o) => [o.id, o]));
  for (const o of now) {
    const old = before.get(o.id);
    if (!old) plan.set(o.id, null);
    else if (JSON.stringify(old) !== JSON.stringify(o)) plan.set(o.id, old);
  }
  for (const o of then) if (!now.some((x) => x.id === o.id)) plan.set(o.id, o);
  return plan;
}

/** the minutes there is a copy for: the oldest copy is at most half an hour old */
export function rewindReach(ctx: Ctx): number {
  const first = logOf(ctx).checkpoints[0];
  return first ? Math.floor((Date.now() - first.at) / 60_000) : 0;
}

/** the whole scene as it was `minutes` ago (or as close to it as there is a copy); returns objects changed */
export function rewind(ctx: Ctx, minutes: number): number {
  if (!amOwner(ctx)) return 0;
  const cp = logOf(ctx).checkpointBefore(Date.now() - minutes * 60_000);
  if (!cp) return 0;
  return restore(ctx, `Rewind ${minutes} min`, rewindPlan(ctx.deps.store.world.objects, cp.world.objects));
}

export type { Change };
