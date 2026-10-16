/** Every message that crosses the wire between peers in a room, as sent. Received data is `unknown` until sanitised. */
import type { Rules } from "@/lib/rules";
import type { Look } from "@/avatar/look";
import type { Quat, Vec3 } from "@/lib/vec";
import type { Obj } from "@/world/model";

/** who I am and what I know about the room; sent on join and whenever any of it changes */
export interface HelloMsg {
  name: string;
  look: Look;
  synced: boolean;
  room: string;
  ver: number;
  /** their copy was just reopened and nobody has changed it since */
  fresh: boolean;
  rules: Rules | null;
  /** the visit key that signs my relay channel */
  vk: string;
  /** my key in this room and its proof (person.ts) */
  pk: string;
  ps: string;
}

/** the whole scene, for a newcomer */
export interface SnapMsg {
  world: { seq: number; objects: Obj[] };
  room: string;
  ver: number;
  rules: Rules | null;
}

/** "the room's copy on the relays is current": for a newcomer whose snapshot would be too big for the relays */
export interface VaultSnapMsg {
  ver: number;
}

/** a guest asks the owner to let them build */
export interface AskMsg {
  at: number;
}

/** objects an action touched: replaced, deleted, and the resulting scene order */
export interface ObjsMsg {
  set: Obj[];
  del: string[];
  order: string[];
  ver: number;
  /** 1 when the authority's scripts made these changes, not a person */
  s?: number;
}

export interface Transform {
  id: string;
  pos: Vec3;
  quat: Quat;
  size: Vec3;
}

/** objects being dragged right now: transforms only, a few times a second */
export interface XfMsg {
  objs: Transform[];
}

/** my avatar: position, yaw, speed, back(wards), (tal)k(ing), flying, si(t)ting, on (g)round, tu(r)n, climb (v) */
export interface AvMsg {
  p: Vec3;
  y: number;
  s: number;
  b: boolean;
  k: boolean;
  f: boolean;
  t: boolean;
  g: boolean;
  r: number;
  v: number;
}

export interface ChatMsg {
  text: string;
}

/** a smooth move started by a script on the authority: where the object goes and how long it takes */
export interface FxMsg {
  id: string;
  pos: Vec3;
  quat: Quat;
  size: Vec3;
  /** seconds */
  d: number;
  /** pivot: world point and local point, when the move is a rotation about a pivot */
  pv?: number[];
}

/** someone touched a scripted object; only the authority acts on it */
export interface TouchMsg {
  id: string;
}

/** an object (its script) said something */
export interface ObjSayMsg {
  id: string;
  text: string;
}

/** bodies the authority's physics is moving: where they are and how fast they go */
export interface BodiesMsg {
  b: { id: string; pos: Vec3; quat: Quat; vel: Vec3 }[];
}

/** a note an object's script played */
export interface NoteMsg {
  id: string;
  n: number;
  i: string;
}

export interface GestureMsg {
  g: string;
}

/** ask a peer for the bytes of the avatar file they wear (by SHA-256). A type alias, not an interface: Trystero's
 *  payload constraint has an index signature, which aliases satisfy and interfaces don't. */
export type FileRequest = {
  h: string;
};

export interface Messages {
  hello: HelloMsg;
  snap: SnapMsg;
  objs: ObjsMsg;
  xf: XfMsg;
  av: AvMsg;
  chat: ChatMsg;
  fx: FxMsg;
  tch: TouchMsg;
  osay: ObjSayMsg;
  gest: GestureMsg;
  body: BodiesMsg;
  note: NoteMsg;
  vsnap: VaultSnapMsg;
  ask: AskMsg;
}

export type ActionName = keyof Messages;

export const ACTION_NAMES: ActionName[] = [
  "hello",
  "snap",
  "objs",
  "xf",
  "av",
  "chat",
  "fx",
  "tch",
  "osay",
  "gest",
  "body",
  "note",
  "vsnap",
  "ask",
];
