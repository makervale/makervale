/** What the input remembers between events: the drag in progress, the fingers down, the cursor. */
import type { ElementPick } from "@/render/preselect";
import type { WorldHit } from "@/render/picking";
import type { InputDeps } from "./deps";
import type { Rubber } from "./rubber";

export type CamMode = "zoom" | "orbit" | "pan";

/** a pointer drag: where it started, where it is, and whether it moved past the click slop */
export interface Track {
  x: number;
  y: number;
  sx: number;
  sy: number;
  moved: boolean;
}

export interface CamDrag {
  type: "cam";
  mode: CamMode;
  /** a right click that didn't move opens the pie menu */
  pie?: boolean;
  /** Alt+click on nothing: there is no point to zoom to */
  valid?: boolean;
  touch?: number;
}

export interface BoxDrag {
  type: "box";
  /** selecting objects (or elements of the edited mesh) */
  objects: boolean;
  shift: boolean;
}

/** Shift+press on an element: a click adds it, a drag pulls new geometry out of it */
export interface PullDrag {
  type: "pull";
  el: ElementPick;
  hit: WorldHit | null;
}

export interface PinchDrag {
  type: "pinch";
  d: number;
  cx: number;
  cy: number;
}

export type ViewDrag = CamDrag | BoxDrag | PullDrag | PinchDrag;

export interface InputCtx extends InputDeps {
  canvas: HTMLCanvasElement;
  rubber: Rubber;
  track: Track | null;
  view: ViewDrag | null;
  touches: Map<number, { x: number; y: number }>;
  last: { x: number; y: number };
}

export interface Mods {
  altKey: boolean;
  ctrlKey: boolean;
  shiftKey: boolean;
  metaKey?: boolean;
}

/** Alt: zoom to a point; Ctrl+Alt: orbit; Ctrl+Alt+Shift: pan */
export function camModeFromMods(e: Mods): CamMode | null {
  if (!e.altKey) return null;
  if (!e.ctrlKey) return "zoom";
  return e.shiftKey ? "pan" : "orbit";
}

/** held modifiers are input state other parts read (the handles, the status line, the avatar's run) */
export function setMods(ctx: InputCtx, e: Mods): void {
  ctx.commands.setModifiers({ alt: e.altKey, ctrl: e.ctrlKey || !!e.metaKey, shift: e.shiftKey });
  ctx.avatar.setShift(e.shiftKey);
}

export const newTrack = (x: number, y: number): Track => ({ x, y, sx: x, sy: y, moved: false });

/** start a drag: the pointer is captured so the drag goes on outside the canvas */
export function capture(ctx: InputCtx, pointerId: number, x: number, y: number, view: ViewDrag | null): void {
  ctx.track = newTrack(x, y);
  ctx.view = view;
  try {
    ctx.canvas.setPointerCapture(pointerId);
  } catch {
    // synthetic events (tests) have no active pointer
  }
}
