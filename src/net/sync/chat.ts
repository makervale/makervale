/** Chat: what people say (with a speech bubble over their avatar), and what objects' scripts say. */
import type { Ctx } from "../context";
import { authorityId, pushChat, send } from "../context";
import { asRecord, cleanText, validId } from "../sanitize";

const MAX_CHAT = 500;
const MAX_OBJECT_SAY = 300;

/** say something: a bubble over my avatar, a chat line, the room hears it, and so do the scripts */
export function say(ctx: Ctx, text: string): void {
  const t = cleanText(text, MAX_CHAT);
  if (!t) return;
  const name = ctx.deps.selfName();
  ctx.deps.peers.say({ kind: "self" }, t);
  send(ctx, "chat", { text: t });
  pushChat(ctx, { from: ctx.net.selfId, name, text: t, at: Date.now(), self: true });
  ctx.deps.scripts.hear(t, name);
}

export function onChat(ctx: Ctx, raw: unknown, pid: string): void {
  const p = ctx.net.peers.get(pid);
  const text = cleanText(asRecord(raw).text, MAX_CHAT);
  if (!text) return;
  const name = p ? p.name : "Someone";
  pushChat(ctx, { from: pid, name, text, at: Date.now() });
  ctx.deps.scripts.hear(text, name);
  if (p) ctx.deps.peers.say({ kind: "peer", id: pid }, text);
}

function objectLine(ctx: Ctx, obj: { id: string; name: string }, text: string): void {
  pushChat(ctx, { from: obj.id, name: obj.name, text, at: Date.now(), obj: true });
  ctx.deps.peers.say({ kind: "object", id: obj.id }, text);
}

/** a script here made an object speak: show it and tell the room */
export function objectSaid(ctx: Ctx, obj: { id: string; name: string }, text: string): void {
  objectLine(ctx, obj, text);
  send(ctx, "osay", { id: obj.id, text });
}

/** an object spoke on the authority (only it runs scripts) */
export function onObjectSay(ctx: Ctx, raw: unknown, pid: string): void {
  const d = asRecord(raw);
  if (pid !== authorityId(ctx) || !validId(d.id)) return;
  const o = ctx.deps.store.byId(d.id);
  const text = cleanText(d.text, MAX_OBJECT_SAY);
  if (o && text) objectLine(ctx, o, text);
}
