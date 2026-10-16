/**
 * The room connection: typed actions in, raw messages out, to each person by the best way there is. Directly
 * (WebRTC) when the two browsers could connect; otherwise through the room's relay channel on the public Nostr
 * relays (channel/), which needs no TURN server. Callers don't see the difference, except through routeOf().
 *
 * Everyone in the room can seal channel messages, so the sender a message names is checked against the visit key
 * that signed its event: the key a peer told us directly (hello), else the first one seen for that peer.
 */
import type { Envelope } from "./channel/outbox";
import type { Channel } from "./channel/channel";
import { openChannel } from "./channel/channel";
import { Members } from "./channel/members";
import type { Route } from "./channel/members";
import type { Direct } from "./direct";
import { openDirect, selfId } from "./direct";
import type { ActionName, Messages } from "./messages";
import { ACTION_NAMES } from "./messages";
import { roomKeys } from "./room-keys";

export { selfId, roomConfig, APP_ID } from "./direct";
export type { Route };

export type MessageHandler = (data: unknown, from: string) => void;

export interface TransportHooks {
  /** false for peers whose messages must be ignored (the owner removed them) */
  accept(peerId: string): boolean;
  onJoinError(reason: string): void;
  onPeerJoin(peerId: string): void;
  onPeerLeave(peerId: string): void;
  /** the bytes of the avatar file I wear, by hash; throws when I don't have it */
  fileRequest(hash: string): Promise<ArrayBuffer>;
}

export interface Transport {
  send<N extends ActionName>(name: N, data: Messages[N], target?: string): void;
  on<N extends ActionName>(name: N, handler: MessageHandler): void;
  routeOf(peerId: string): Route | null;
  /** 0 normally; higher when the relays asked the room's channel to slow down */
  relaySlowdown(): number;
  /** the visit key a peer told us over a direct connection: from now on only it may speak for them on the relays */
  knowVisitKey(peerId: string, key: string): void;
  /** direct connections only */
  requestFile(hash: string, from: string, timeoutMs: number): Promise<unknown>;
  drop(peerId: string): void;
  leave(): Promise<void>;
}

const TICK_MS = 2000;
const HERE_EVERY_MS = 15_000;
const APP_NAMES = new Set<string>(ACTION_NAMES);

const msgId = () => Math.random().toString(36).slice(2, 12) + Date.now().toString(36);

interface Mesh {
  hooks: TransportHooks;
  handlers: Map<string, MessageHandler>;
  members: Members;
  senders: Map<string, string>;
  direct: Direct | null;
  channel: Channel | null;
}

function deliver(mesh: Mesh, name: string, data: unknown, from: string): void {
  if (mesh.hooks.accept(from)) mesh.handlers.get(name)?.(data, from);
}

function genuine(mesh: Mesh, origin: string, sender: string): boolean {
  const known = mesh.senders.get(origin);
  if (!known) mesh.senders.set(origin, sender);
  return !known || known === sender;
}

function onEnvelope(mesh: Mesh, env: Envelope, sender: string): void {
  if (env.o === selfId || !genuine(mesh, env.o, sender)) return;
  const now = Date.now();
  if (env.n === "_here") return mesh.members.heardFrom(env.o, now);
  if (env.n === "_bye") return mesh.members.gone(env.o);
  if (!APP_NAMES.has(env.n) || !env.t.includes(selfId)) return;
  let data: unknown;
  try {
    data = JSON.parse(env.j);
  } catch {
    return;
  }
  mesh.members.relayedNow(env.o, now);
  deliver(mesh, env.n, data, env.o);
}

function post(mesh: Mesh, name: string, data: unknown, targets: string[]): void {
  mesh.channel?.post({ o: selfId, t: targets, n: name, j: JSON.stringify(data ?? {}), m: msgId() });
}

async function connect(mesh: Mesh, code: string): Promise<void> {
  const keys = await roomKeys(code);
  mesh.direct = openDirect(keys, {
    onJoin: (pid) => mesh.members.directUp(pid),
    onLeave: (pid) => mesh.members.directDown(pid, Date.now()),
    onJoinError: mesh.hooks.onJoinError,
    deliver: (name, data, from) => deliver(mesh, name, data, from),
    fileRequest: mesh.hooks.fileRequest,
  });
  mesh.channel = openChannel(keys, (env, sender) => onEnvelope(mesh, env, sender));
  post(mesh, "_here", {}, []);
}

function sendTo(mesh: Mesh, name: ActionName, data: unknown, target?: string): void {
  if (target) {
    const route = mesh.members.route(target);
    if (route === "direct") mesh.direct?.send(name, data, target);
    else if (route === "relay") post(mesh, name, data, [target]);
    return;
  }
  if (mesh.members.directCount()) mesh.direct?.send(name, data);
  const relayed = mesh.members.relayTargets();
  if (relayed.length) post(mesh, name, data, relayed);
}

export function openTransport(code: string, hooks: TransportHooks): Transport {
  const mesh: Mesh = { hooks, handlers: new Map(), members: null!, senders: new Map(), direct: null, channel: null };
  mesh.members = new Members({ join: hooks.onPeerJoin, leave: hooks.onPeerLeave });
  // leaving before the keys are ready waits for them, then closes what was opened
  const ready = connect(mesh, code);
  const tick = setInterval(() => mesh.members.tick(Date.now()), TICK_MS);
  const here = setInterval(() => post(mesh, "_here", {}, []), HERE_EVERY_MS);
  async function close(): Promise<void> {
    post(mesh, "_bye", {}, []);
    await mesh.channel?.flush();
    mesh.channel?.close();
    await mesh.direct?.leave();
  }
  return {
    send: (name, data, target) => sendTo(mesh, name, data, target),
    on: (name, handler) => void mesh.handlers.set(name, handler),
    routeOf: (pid) => mesh.members.route(pid),
    relaySlowdown: () => mesh.channel?.slowdown ?? 0,
    knowVisitKey: (pid, key) => void mesh.senders.set(pid, key),
    requestFile: (hash, from, timeoutMs) =>
      mesh.direct && mesh.members.route(from) === "direct"
        ? mesh.direct.requestFile(hash, from, timeoutMs)
        : Promise.reject(new Error("not connected directly")),
    drop(pid) {
      mesh.direct?.drop(pid);
      mesh.members.gone(pid);
    },
    async leave() {
      clearInterval(tick);
      clearInterval(here);
      await ready.catch(() => {});
      await close();
    },
  };
}
