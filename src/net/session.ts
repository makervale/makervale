/**
 * The session: the one object the UI talks to about multiplayer. Rooms are live meetings: browsers connect directly
 * (WebRTC), or through the public Nostr relays when they can't; whoever opens a room brings the scene, newcomers get
 * a copy, then everyone sends what they change. The Gallery is separate: published, versioned worlds you look at
 * alone or copy. Scripts run on one peer per room, the authority; see sync/scripts.ts.
 */
import type { Look } from "@/avatar/look";
import { createRules } from "@/lib/rules";
import { keepAnnounced } from "./announcer";
import type { ConnectionApi } from "./connection";
import { connectionApi } from "./connection";
import type { Ctx, SessionDeps } from "./context";
import { amAuthority, authorityId, inRoom, sendHello } from "./context";
import type { GalleryApi } from "./gallery-api";
import { galleryApi } from "./gallery-api";
import { moderationTick } from "./moderation";
import type { OwnerApi } from "./owner-api";
import { ownerApi } from "./owner-api";
import { browsePublicRooms } from "./public-rooms";
import type { PublicRoom } from "./public-rooms";
import { deleteRoom, makeCopy } from "./room-actions";
import { host, join, leave, onPageHide, reopen } from "./rooms";
import type { RoomKind } from "@/lib/rules";
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
import { vaultTick } from "./vault";
import { closeView } from "./viewing";

export interface RoomApi {
  /** what this browser knows about the room (name, code, peers, chat, rules, selfId); only net writes it */
  readonly net: Readonly<NetState>;
  /** open a new room with the current scene; resolves with its code */
  host(name: string, kind: RoomKind): Promise<string>;
  /** join by code (a public room: from the list); our saved copy of a private room is used when we have one */
  join(code: string, kind?: RoomKind, name?: string): Promise<void>;
  reopen(code: string): Promise<boolean>;
  leave(): Promise<void>;
  /** a private room of ours from this room's scene now; we go there */
  makeCopy(): Promise<string>;
  inRoom(): boolean;
  /** your own scene is showing (not a room, not a world you are viewing) */
  inOwnScene(): boolean;
  savedRooms(): Promise<SavedRoomInfo[]>;
  /** only out of this browser */
  forgetRoom(code: string): Promise<void>;
  /** the owner: off the relays and out of this browser; false if we aren't its owner */
  deleteRoom(code: string): Promise<boolean>;
  browsePublicRooms(onList: (rooms: PublicRoom[]) => void): () => void;
  /** per frame: send my avatar now and then, move everyone else's, save the room after changes */
  tick(dt: number): void;
}

export interface PeopleApi {
  setIdentity(name: string, look: Look): void;
  say(text: string): void;
  gesture(name: string): void;
  /** the bytes of a "file:" avatar model someone in the room wears (for VrmLoader.setRemoteFetch) */
  fetchFile(hash: string): Promise<ArrayBuffer | null>;
  /** the peer that runs the scripts */
  authorityId(): string;
  amAuthority(): boolean;
}

export type Session = RoomApi & PeopleApi & OwnerApi & GalleryApi & ConnectionApi;

const ANNOUNCE_EVERY_S = 1;

function roomApi(ctx: Ctx): RoomApi {
  let sinceAnnounce = 0;
  const outOfView = <T>(fn: () => Promise<T>) => {
    closeView(ctx);
    return fn();
  };
  return {
    net: ctx.net,
    host: (name, kind) => outOfView(() => host(ctx, name, kind)),
    join: (code, kind, name) => outOfView(() => join(ctx, code, kind, name)),
    reopen: (code) => outOfView(() => reopen(ctx, code)),
    leave: () => leave(ctx),
    makeCopy: () => makeCopy(ctx),
    inRoom: () => inRoom(ctx),
    inOwnScene: () => !inRoom(ctx) && !ctx.net.viewing,
    savedRooms: () => savedRooms((r) => ctx.rules.ownsRules(r)),
    forgetRoom,
    deleteRoom: (code) => deleteRoom(ctx, code),
    browsePublicRooms,
    tick(dt) {
      avatarTick(ctx, dt);
      saveTick(ctx, dt);
      vaultTick(ctx, dt);
      sinceAnnounce += dt;
      if (sinceAnnounce < ANNOUNCE_EVERY_S) return;
      sinceAnnounce = 0;
      keepAnnounced(ctx);
      moderationTick(ctx);
    },
  };
}

interface Identity {
  current: { name: string; look: Look } | null;
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
    authorityId: () => authorityId(ctx),
    amAuthority: () => amAuthority(ctx),
  };
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
  deps.bus.on("world:changed", (e) => onLocalEdit(ctx, e.ids, e.reverted));
  deps.bus.on("world:dragging", (e) => onLocalDrag(ctx, e.ids));
  // in a room the law is the same for everyone, its owner included: nobody brings in a scene over it
  deps.commands.space.mayTakeAsIs = () => !inRoom(ctx);
  if (typeof window !== "undefined") window.addEventListener("pagehide", () => onPageHide(ctx));
  const parts = [roomApi(ctx), peopleApi(ctx, identity), ownerApi(ctx), galleryApi(ctx), connectionApi()];
  return Object.assign({}, ...parts) as Session;
}
