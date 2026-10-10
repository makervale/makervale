/** What this browser knows about the room it is in. Features read it (the multiplayer window, chat); only net writes. */
import type { Look } from "@/avatar/look";
import { DEFAULT_LOOK } from "@/avatar/look";
import type { Rules } from "@/lib/rules";
import type { AvatarSnapshot } from "./peers";

export interface PeerState {
  id: string;
  name: string;
  /** their shirt colour, for chat names and lists */
  color: string;
  look: Look;
  /** they have the room's scene */
  synced: boolean;
  /** the version of their copy of the room */
  ver: number;
  /** their copy was just reopened from disk: a live copy (someone who stayed in the room) beats it */
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

export interface NetState {
  readonly selfId: string;
  /** room code; "" outside rooms */
  id: string;
  name: string;
  isPublic: boolean;
  /** we have the room's scene (or brought it) */
  synced: boolean;
  peers: Map<string, PeerState>;
  chat: ChatLine[];
  /** the peer currently listing the room publicly */
  advertiser: string;
  /** grows with every change; the higher copy wins when two copies of a room meet */
  ver: number;
  /** reopened from our saved copy and nothing changed yet: a newer copy from someone else replaces it */
  fresh: boolean;
  /** the host's signed rules: who may build, who was removed */
  rules: Rules | null;
}

export const MAX_CHAT_LINES = 200;

export function createNetState(selfId: string): NetState {
  return {
    selfId,
    id: "",
    name: "",
    isPublic: false,
    synced: false,
    peers: new Map(),
    chat: [],
    advertiser: "",
    ver: 0,
    fresh: false,
    rules: null,
  };
}

export const newPeer = (id: string): PeerState => ({
  id,
  name: "",
  color: "#888888",
  look: { ...DEFAULT_LOOK },
  synced: false,
  ver: 0,
  fresh: false,
  target: null,
});
