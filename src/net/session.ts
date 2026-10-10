/**
 * The room session: the one object the UI talks to about multiplayer. Browsers connect directly (WebRTC); public
 * Nostr relays only introduce them and list public rooms. Whoever opens a room brings the scene; newcomers get a copy
 * from the longest-standing peer, then everyone sends what they change. The last change to an object wins.
 * Scripts run on one peer per room, the authority; see sync/scripts.ts.
 */
import type { Look } from "@/avatar/look";
import { createRules } from "@/lib/rules";
import { setPublic } from "./advertising";
import type { ConnectionApi } from "./connection";
import { connectionApi } from "./connection";
import type { Ctx, SessionDeps } from "./context";
import { amAuthority, authorityId, inRoom, sendHello } from "./context";
import { host, join, leave, newRoomId, onPageHide, reopen } from "./rooms";
import { amHost, canBuild, canIBuild, hostId, kick, setBuildRule } from "./rules";
import type { SavedRoomInfo } from "./saved-rooms";
import { forgetRoom, saveTick, savedRooms } from "./saved-rooms";
import type { NetState } from "./state";
import { createNetState } from "./state";
import { avatarTick, sendGesture } from "./sync/avatars";
import { say } from "./sync/chat";
import { onLocalDrag } from "./sync/drag";
import { physicsHooks } from "./sync/bodies";
import { fetchFile } from "./sync/files";
import { onLocalEdit } from "./sync/objects";
import { scriptHooks } from "./sync/scripts";
import { selfId } from "./transport";

export interface RoomApi {
  /** what this browser knows about the room (name, code, peers, chat, rules, selfId); only net writes it */
  readonly net: Readonly<NetState>;
  /** open a room with the current scene; returns its code */
  host(name: string, listPublicly: boolean): string;
  /** join by code; our saved copy is used when we have one */
  join(id: string, name?: string): Promise<void>;
  /** reopen a saved room; false when there is no saved copy */
  reopen(id: string): Promise<boolean>;
  leave(): Promise<void>;
  inRoom(): boolean;
  inOwnScene(): boolean;
  newRoomId(): string;
  savedRooms(): Promise<SavedRoomInfo[]>;
  forgetRoom(id: string): Promise<void>;
  /** per frame: send my avatar now and then, move everyone else's, save the room after changes */
  tick(dt: number): void;
}

export interface PeopleApi {
  /** my name and look changed: tell the room */
  setIdentity(name: string, look: Look): void;
  say(text: string): void;
  /** I play a gesture: everyone sees it */
  gesture(name: string): void;
  /** the bytes of a "file:" avatar model someone in the room wears (for VrmLoader.setRemoteFetch) */
  fetchFile(hash: string): Promise<ArrayBuffer | null>;
}

export interface HostApi {
  setPublic(listed: boolean): void;
  setBuildRule(everyone: boolean): Promise<void>;
  kick(peerId: string): Promise<void>;
  canIBuild(): boolean;
  canBuild(peerId: string): boolean;
  amHost(): boolean;
  hostId(): string;
  /** the peer that runs the scripts */
  authorityId(): string;
  amAuthority(): boolean;
}

export type Session = RoomApi & PeopleApi & HostApi & ConnectionApi;

function roomApi(ctx: Ctx): RoomApi {
  return {
    net: ctx.net,
    host: (name, listPublicly) => host(ctx, name, listPublicly),
    join: (id, name) => join(ctx, id, name),
    reopen: (id) => reopen(ctx, id),
    leave: () => leave(ctx),
    inRoom: () => inRoom(ctx),
    inOwnScene: () => !inRoom(ctx),
    newRoomId,
    savedRooms,
    forgetRoom,
    tick(dt) {
      avatarTick(ctx, dt);
      saveTick(ctx, dt);
    },
  };
}

function peopleApi(ctx: Ctx, identity: Identity): PeopleApi {
  return {
    setIdentity(name, look) {
      identity.current = { name, look };
      sendHello(ctx);
    },
    say: (text) => say(ctx, text),
    gesture: (name) => sendGesture(ctx, name),
    fetchFile: (hash) => fetchFile(ctx, hash),
  };
}

function hostApi(ctx: Ctx): HostApi {
  return {
    setPublic: (listed) => setPublic(ctx, listed),
    setBuildRule: (everyone) => setBuildRule(ctx, everyone),
    kick: (peerId) => kick(ctx, peerId),
    canIBuild: () => canIBuild(ctx),
    canBuild: (peerId) => canBuild(ctx, peerId),
    amHost: () => amHost(ctx),
    hostId: () => hostId(ctx),
    authorityId: () => authorityId(ctx),
    amAuthority: () => amAuthority(ctx),
  };
}

interface Identity {
  current: { name: string; look: Look } | null;
}

/** the name and look set through setIdentity win over what deps report */
function withIdentity(deps: SessionDeps, identity: Identity): SessionDeps {
  return {
    ...deps,
    selfName: () => identity.current?.name ?? deps.selfName(),
    selfLook: () => identity.current?.look ?? deps.selfLook(),
  };
}

export function createSession(deps: SessionDeps): Session {
  const identity: Identity = { current: null };
  const ctx: Ctx = {
    deps: withIdentity(deps, identity),
    net: createNetState(selfId),
    rules: createRules(deps.keyStore),
    link: null,
    applyingRemote: false,
    leave: () => leave(ctx),
  };
  deps.scripts.connect(scriptHooks(ctx));
  deps.physics.connect(physicsHooks(ctx));
  // local edits reach the room by listening; changes net makes itself are marked and not sent back
  deps.bus.on("world:changed", (e) => onLocalEdit(ctx, e.ids));
  deps.bus.on("world:dragging", (e) => onLocalDrag(ctx, e.ids));
  if (typeof window !== "undefined") window.addEventListener("pagehide", () => onPageHide(ctx));
  return { ...roomApi(ctx), ...peopleApi(ctx, identity), ...hostApi(ctx), ...connectionApi() };
}
