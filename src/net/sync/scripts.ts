/**
 * Scripts run on the authority only. Others forward their touches to it; it sends back smooth moves (fx), changed
 * objects (as ordinary edits) and what objects say. Everyone replays the moves on their own, so motion stays smooth.
 */
import type { Vec3 } from "@/lib/vec";
import type { Ctx } from "../context";
import { amAuthority, authorityId, inRoom, quietly, send } from "../context";
import { canBuild } from "../rules";
import { asRecord, cleanFx, cleanNum, validId } from "../sanitize";
import type { Fx, ScriptNetHooks } from "../scripts-bridge";
import { objectSaid } from "./chat";
import { queueObjs } from "./objects";

/* scripted motion and script state are not part of the saved scene (world/resting.ts), so they don't move the
   room's version: only real edits make a copy newer */
function moved(ctx: Ctx, fx: Fx): void {
  if (inRoom(ctx) && ctx.net.synced) send(ctx, "fx", fx);
}

function scriptsChanged(ctx: Ctx, ids: string[]): void {
  queueObjs(ctx, ids);
}

function forwardTouch(ctx: Ctx, id: string): void {
  if (!inRoom(ctx) || !ctx.net.synced) return;
  const a = authorityId(ctx);
  if (a === ctx.net.selfId) return;
  // the authority may not have said hello yet: then tell everyone, and only the authority acts on it
  send(ctx, "tch", { id }, ctx.net.peers.has(a) ? a : undefined);
}

function avatars(ctx: Ctx): { name: string; pos: Vec3 }[] {
  const out = [{ name: ctx.deps.selfName(), pos: ctx.deps.localAvatar().pos }];
  for (const p of ctx.net.peers.values()) if (p.target) out.push({ name: p.name, pos: p.target.pos });
  return out;
}

/** what the script runtime calls on net */
export function scriptHooks(ctx: Ctx): ScriptNetHooks {
  return {
    isAuthority: () => amAuthority(ctx),
    onMoved: (fx) => moved(ctx, fx),
    onChanged: (ids) => scriptsChanged(ctx, ids),
    onSay: (obj, text) => objectSaid(ctx, obj, text),
    onPlay: (id, n, i) => {
      if (inRoom(ctx) && ctx.net.synced) send(ctx, "note", { id, n, i });
    },
    onForwardTouch: (id) => forwardTouch(ctx, id),
    avatars: () => avatars(ctx),
    quietly: (change) => quietly(ctx, change),
  };
}

/** a smooth move from the authority's scripts */
export function onFx(ctx: Ctx, raw: unknown, pid: string): void {
  if (!ctx.net.synced || pid !== authorityId(ctx)) return;
  const fx = cleanFx(raw);
  if (!fx) return;
  if (!canBuild(ctx, pid) && !ctx.deps.store.byId(fx.id)?.script) return;
  ctx.deps.scripts.applyEffect(fx);
}

/** someone touched a scripted object; only the authority acts on it */
export function onTouch(ctx: Ctx, raw: unknown, pid: string): void {
  const id = asRecord(raw).id;
  if (!validId(id) || !amAuthority(ctx)) return;
  const p = ctx.net.peers.get(pid);
  if (p) ctx.deps.scripts.touch(id, p.name);
}

const INSTRUMENT = /^[a-z]{1,16}$/;
const NOTE_RANGE = 24;

/** a note from the authority's scripts */
export function onNote(ctx: Ctx, raw: unknown, pid: string): void {
  if (!ctx.net.synced || pid !== authorityId(ctx)) return;
  const d = asRecord(raw);
  const note = cleanNum(d.n, -NOTE_RANGE, NOTE_RANGE);
  if (!validId(d.id) || note === null || typeof d.i !== "string" || !INSTRUMENT.test(d.i)) return;
  if (!ctx.deps.store.byId(d.id)?.script) return;
  ctx.deps.bus.emit("sound:play", { id: d.id, note: Math.round(note), instrument: d.i });
}
