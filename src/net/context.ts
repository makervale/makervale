/**
 * What every part of the session shares: the app it talks to (deps), what it knows about the room (net), and the
 * open connection (link). The sync/ files, rules.ts and rooms.ts are plain functions over this context.
 */
import type { Bus } from "@/app/bus";
import type { Commands } from "@/app/commands";
import type { Store } from "@/app/store";
import type { Look } from "@/avatar/look";
import type { KeyStore, RulesApi } from "@/lib/rules";
import { pickAuthority } from "./authority";
import type { ActionName, HelloMsg, Messages } from "./messages";
import type { AvatarSnapshot, PeerBodies } from "./peers";
import type { PhysicsBridge } from "./physics-bridge";
import type { ScriptBridge } from "./scripts-bridge";
import { visitKey } from "./nostr";
import { proveMe } from "./person";
import type { ChatLine, NetState } from "./state";
import { MAX_CHAT_LINES, kindOf } from "./state";
import type { Transport } from "./transport";

export interface SessionDeps {
  store: Store;
  bus: Bus;
  commands: Commands;
  peers: PeerBodies;
  localAvatar: () => AvatarSnapshot;
  scripts: ScriptBridge;
  physics: PhysicsBridge;
  selfName: () => string;
  selfLook: () => Look;
  /** where room owner keys are kept (localStorage in the browser) */
  keyStore: KeyStore;
}

export interface Ctx {
  readonly deps: SessionDeps;
  readonly net: NetState;
  readonly rules: RulesApi;
  /** the room connection; null outside rooms */
  link: Transport | null;
  /** true while net itself changes the scene; see applyRemote */
  applyingRemote: boolean;
  /** set by session.ts: rules.ts must leave when the owner removes us, but rooms.ts (which leaves) imports it */
  leave: () => Promise<void>;
}

export const inRoom = (ctx: Ctx): boolean => ctx.link !== null;

export function changed(ctx: Ctx): void {
  ctx.deps.bus.emit("room:changed");
}

export function pushChat(ctx: Ctx, line: ChatLine): void {
  const chat = ctx.net.chat;
  chat.push(line);
  if (chat.length > MAX_CHAT_LINES) chat.shift();
  ctx.deps.bus.emit("chat:message");
}

export function system(ctx: Ctx, text: string): void {
  pushChat(ctx, { from: "", name: "", text, at: Date.now(), system: true });
}

export function send<N extends ActionName>(ctx: Ctx, name: N, data: Messages[N], target?: string): void {
  ctx.link?.send(name, data, target);
}

export function helloMsg(ctx: Ctx): HelloMsg {
  const n = ctx.net;
  const me = {
    name: ctx.deps.selfName(),
    look: ctx.deps.selfLook(),
    vk: visitKey,
    ...proveMe(n.id, n.selfId, visitKey),
  };
  return { ...me, synced: n.synced, room: n.name, ver: n.ver, fresh: n.fresh, rules: n.rules };
}

/** tell everyone (or one newcomer) who we are and what we know about the room */
export function sendHello(ctx: Ctx, target?: string): void {
  send(ctx, "hello", helloMsg(ctx), target);
}

/** a public room runs on its owner's computer, and only while the owner is in it; "" then means nobody */
function publicAuthority(n: NetState): string {
  const host = n.rules?.host ?? "";
  if (host === n.selfId) return n.synced ? host : "";
  return n.peers.get(host)?.synced ? host : "";
}

export const authorityId = (ctx: Ctx): string =>
  kindOf(ctx.net) === "public"
    ? publicAuthority(ctx.net)
    : pickAuthority(ctx.net.selfId, ctx.net.synced, ctx.net.peers.values());

/** should scripts run here? always outside rooms; in a room only on the authority, once it has the scene */
export const amAuthority = (ctx: Ctx): boolean =>
  !inRoom(ctx) || (ctx.net.synced && authorityId(ctx) === ctx.net.selfId);

/**
 * Change the scene on behalf of a peer (or the script runtime). commands.apply raises world:changed like any edit,
 * and net sends local edits by listening to world:changed; the flag tells that listener this change came from the
 * room and must not be sent back into it (it would echo between peers forever).
 */
export function applyRemote(ctx: Ctx, ids: Iterable<string>, change: () => void): void {
  quietly(ctx, () => ctx.deps.commands.apply(ids, change));
}

/** run any change with world:changed echoes suppressed (scene replacement, the script runtime's own changes) */
export function quietly(ctx: Ctx, change: () => void): void {
  const was = ctx.applyingRemote;
  ctx.applyingRemote = true;
  try {
    change();
  } finally {
    ctx.applyingRemote = was;
  }
}
