import type { Bus } from "@/app/bus";
import type { Look } from "@/avatar/look";
import type { Identity } from "./identity";
import type { PickerState } from "./tiles";

/** what the window shows about your body while a model loads (old viewport/avatar.ts myFigure()) */
export interface FigureStatus {
  /** the model being loaded, or "" */
  loading: string;
  /** why the last model failed, or "" */
  failed: string;
  vrm: unknown;
}

/** your avatar (old viewport/avatar.ts and viewport/vrm.ts) */
export interface AvatarPort {
  setAvatarLook(name: string, look: Look): void;
  myFigure(): FigureStatus | null;
  /** keep a .vrm you picked, once it's known to be usable; returns its model name */
  addLocalModel(buf: ArrayBuffer): Promise<string>;
}

/** the room session (old net/session.ts): tells the room who you are */
export interface IdentityPort {
  setIdentity(name: string, look: Look): void;
}

export interface AvatarWindowDeps {
  bus: Bus;
  /** shared with the session and the other windows; this window changes it and emits identity:changed */
  identity: Identity;
  avatar: AvatarPort;
  session: IdentityPort;
  /** where the window goes; #stage by default */
  stage?: HTMLElement;
}

/** the mounted window, as its actions see it */
export interface AvatarWindow {
  deps: AvatarWindowDeps;
  body: HTMLElement;
  picker: PickerState;
  render(): void;
  /** store the identity, tell the room and the avatar, emit identity:changed */
  save(): void;
}
