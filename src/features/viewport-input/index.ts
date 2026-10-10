/**
 * Mouse, touch and keyboard in the 3D view. Building (the Build window open): clicks select, drags move or
 * box-select, handles and live tools are driven from here. Not building: clicks touch scripted objects and drags
 * turn the camera. Keys go to the active tool, then the avatar, then the shortcuts.
 */
import { doubleClick } from "./double-click";
import type { InputDeps } from "./deps";
import { keyDown } from "./keyboard";
import { mouseDown } from "./pointer-down";
import { pointerMove } from "./pointer-move";
import { mouseUp } from "./pointer-up";
import { Rubber } from "./rubber";
import type { InputCtx } from "./state";
import { setMods } from "./state";
import { touchDown, touchMove, touchUp } from "./touch";
import { leaveBuildingOnClose, wireAvatarButton } from "./building";

export type { AvatarPort, InputDeps, LivePort, ManipPort, ScriptsPort } from "./deps";

/** wheel zoom: distance factor per wheel unit, and the largest step one event may take */
const ZOOM_PER_UNIT = 1.0015;
const MAX_WHEEL = 300;

export function mount(deps: InputDeps): void {
  const canvas = deps.renderer.picker.canvas;
  const ctx: InputCtx = {
    ...deps,
    canvas,
    rubber: new Rubber(deps.stage),
    track: null,
    view: null,
    touches: new Map(),
    last: { x: 0, y: 0 },
  };
  canvas.addEventListener("contextmenu", (e) => e.preventDefault());
  canvas.addEventListener("pointerdown", (e) => {
    canvas.focus({ preventScroll: true });
    if (e.pointerType === "touch") touchDown(ctx, e);
    else mouseDown(ctx, e);
  });
  window.addEventListener("pointermove", (e) => (e.pointerType === "touch" ? touchMove(ctx, e) : pointerMove(ctx, e)));
  const up = (e: PointerEvent) => (e.pointerType === "touch" ? touchUp(ctx, e) : mouseUp(ctx));
  window.addEventListener("pointerup", up);
  window.addEventListener("pointercancel", up);
  canvas.addEventListener("dblclick", (e) => doubleClick(ctx, e));
  canvas.addEventListener("wheel", (e) => wheel(ctx, e), { passive: false });
  canvas.addEventListener("pointerleave", () => deps.renderer.preselect.clear());
  listenToKeys(ctx);
  leaveBuildingOnClose(ctx);
  wireAvatarButton(ctx);
}

function wheel(ctx: InputCtx, e: WheelEvent): void {
  e.preventDefault();
  if (ctx.live.active()) ctx.live.wheel(e.deltaY < 0 ? 1 : -1);
  else ctx.renderer.camera.zoomIn(Math.pow(ZOOM_PER_UNIT, Math.max(-MAX_WHEEL, Math.min(MAX_WHEEL, e.deltaY))));
}

function listenToKeys(ctx: InputCtx): void {
  window.addEventListener("keydown", (e) => keyDown(ctx, e));
  window.addEventListener("keyup", (e) => {
    setMods(ctx, e);
    ctx.avatar.key(e, false);
  });
  // keys released while the page was in the background never send keyup
  window.addEventListener("blur", () => {
    setMods(ctx, { altKey: false, ctrlKey: false, shiftKey: false });
    ctx.avatar.releaseKeys();
  });
}
