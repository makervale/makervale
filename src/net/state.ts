/** What this browser knows about the room it is in. Features read it (the multiplayer window, chat); only net writes. */
import type { Look } from "@/avatar/look";
import { DEFAULT_LOOK } from "@/avatar/look";
import type { RoomKind, Rules } from "@/lib/rules";
import type { AvatarSnapshot } from "./peers";

export interface PeerState {
  id: string;
  name: string;
  /** their shirt colour, for chat names and lists */
  color: string;
  look: Look;
  /** their key in this room (person.ts); "" until they proved one */
  person: string;
  /** they have the room's scene */
  synced: boolean;
  /** the version of their copy of the room */
  ver: number;
  /** their copy was just reopened and nothing changed since: a live copy beats it */
  fresh: boolean;
  /** where their avatar is heading; null until they sent one */
  target: AvatarSnapshot | null;
}

export interface ChatLine {
  /** peer id, object id (obj), or "" (system) */
  from: string;
  name: string;
  text: string;
  at: number;
  self?: boolean;
  system?: boolean;
  obj?: boolean;
}

/** a private room's copy on the relays (Keep online), as this browser last saw or saved it */
export interface VaultStatus {
  state: "off" | "loading" | "saving" | "saved" | "failed" | "none";
  /** when it was last saved (by anyone), ms; 0 when unknown */
  at: number;
  /** relays that took our last save */
  relays: number;
}

export const noVault = (): VaultStatus => ({ state: "off", at: 0, relays: 0 });

/** a world from the Gallery you are looking at, alone and offline, instead of your own scene */
export interface Viewing {
  title: string;
  by: string;
  version: number;
  latest: number;
  worldId: string;
  author: string;
}

export interface NetState {
  readonly selfId: string;
  /** room code; "" outside rooms */
  id: string;
  name: string;
  /** what we were told before the rules arrived (a public room is joined from the list); the rules then decide */
  kind: RoomKind;
  /** we have the room's scene (or brought it) */
  synced: boolean;
  peers: Map<string, PeerState>;
  chat: ChatLine[];
  /** grows with every change; the higher copy wins when two copies of a room meet */
  ver: number;
  /** reopened from a saved copy and nothing changed yet: a live copy from someone else replaces it */
  fresh: boolean;
  rules: Rules | null;
  vault: VaultStatus;
  /** we changed the scene while nobody else had it: if another copy wins, ours is kept as "your version" */
  pending: boolean;
  viewing: Viewing | null;
}

export const MAX_CHAT_LINES = 200;

export function createNetState(selfId: string): NetState {
  return {
    selfId,
    id: "",
    name: "",
    kind: "private",
    synced: false,
    peers: new Map(),
    chat: [],
    ver: 0,
    fresh: false,
    rules: null,
    vault: noVault(),
    pending: false,
    viewing: null,
  };
}

export const newPeer = (id: string): PeerState => ({
  id,
  name: "",
  color: "#888888",
  look: { ...DEFAULT_LOOK },
  person: "",
  synced: false,
  ver: 0,
  fresh: false,
  target: null,
});

/** the kind that counts: the owner's rules once we have them */
export const kindOf = (n: NetState): RoomKind => n.rules?.kind ?? n.kind;
