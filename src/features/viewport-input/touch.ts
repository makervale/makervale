/**
 * Touch: one finger orbits (or drives a handle), two fingers pinch-zoom and pan, a tap selects or touches, and a
 * finger held still opens the pie menu (the right click of touch screens).
 */
import { isOpen } from "@/ui/window";
import { pointerMove } from "./pointer-move";
import { placeAt, toggleElement, touchAt } from "./select";
import type { InputCtx } from "./state";
import { capture } from "./state";

export function touchDown(ctx: InputCtx, e: PointerEvent): void {
  ctx.touches.set(e.pointerId, { x: e.clientX, y: e.clientY });
  const { manip } = ctx;
  if (ctx.touches.size === 1) {
    const handle = manip.mode() ? manip.pickHandle(e.clientX, e.clientY) : null;
    if (handle) {
      manip.startHandle(handle, e.clientX, e.clientY, false).touch = e.pointerId;
      capture(ctx, e.pointerId, e.clientX, e.clientY, null);
      return;
    }
    capture(ctx, e.pointerId, e.clientX, e.clientY, { type: "cam", mode: "orbit", touch: e.pointerId });
    watchLongPress(ctx, e.pointerId, e.clientX, e.clientY);
  } else if (ctx.touches.size === 2 && !manip.drag) {
    const [a, b] = [...ctx.touches.values()];
    ctx.track = null;
    ctx.view = { type: "pinch", d: Math.hypot(a.x - b.x, a.y - b.y), cx: (a.x + b.x) / 2, cy: (a.y + b.y) / 2 };
  }
}

/** how long a finger rests in place to count as a right click */
const LONG_PRESS_MS = 550;
const LONG_PRESS_BUZZ_MS = 12;

/** touch has no right click: holding a finger still on the view opens the pie menu instead */
function watchLongPress(ctx: InputCtx, finger: number, x: number, y: number): void {
  window.setTimeout(() => {
    const v = ctx.view;
    const still = v?.type === "cam" && v.touch === finger && !ctx.track?.moved && ctx.touches.size === 1;
    if (!still || !ctx.touches.has(finger)) return;
    // forget the drag, so lifting the finger isn't also a tap
    ctx.view = null;
    ctx.track = null;
    navigator.vibrate?.(LONG_PRESS_BUZZ_MS);
    ctx.bus.emit("pie:open", { x, y });
  }, LONG_PRESS_MS);
}

export function touchMove(ctx: InputCtx, e: PointerEvent): void {
  if (!ctx.touches.has(e.pointerId)) return;
  ctx.touches.set(e.pointerId, { x: e.clientX, y: e.clientY });
  const v = ctx.view;
  if (v?.type === "pinch" && ctx.touches.size >= 2) {
    const [a, b] = [...ctx.touches.values()];
    const d = Math.hypot(a.x - b.x, a.y - b.y);
    const cx = (a.x + b.x) / 2;
    const cy = (a.y + b.y) / 2;
    ctx.renderer.camera.zoomIn(v.d / Math.max(1, d));
    ctx.renderer.camera.pan(cx - v.cx, cy - v.cy);
    Object.assign(v, { d, cx, cy });
    return;
  }
  const mine = (v?.type === "cam" && v.touch === e.pointerId) || ctx.manip.drag?.touch === e.pointerId;
  if (!mine) return;
  const plain = { altKey: false, ctrlKey: false, shiftKey: false };
  pointerMove(ctx, { clientX: e.clientX, clientY: e.clientY, target: ctx.canvas, ...plain });
}

export function touchUp(ctx: InputCtx, e: PointerEvent): void {
  ctx.touches.delete(e.pointerId);
  if (ctx.manip.drag && ctx.manip.drag.touch === e.pointerId) {
    ctx.track = null;
    ctx.manip.end();
    return;
  }
  const v = ctx.view;
  if (!v) return;
  if (v.type === "pinch") {
    if (!ctx.touches.size) ctx.view = null;
    return;
  }
  if (v.type !== "cam" || v.touch !== e.pointerId) return;
  const moved = ctx.track?.moved;
  ctx.view = null;
  ctx.track = null;
  if (!moved) tap(ctx, e.clientX, e.clientY);
}

/** a tap: touch a scripted object, place, toggle an element, or select an object */
function tap(ctx: InputCtx, x: number, y: number): void {
  if (!isOpen("build")) {
    touchAt(ctx, x, y);
    return;
  }
  const { store, renderer, commands } = ctx;
  if (store.toolMode === "create") {
    placeAt(ctx, x, y);
    return;
  }
  const el = store.editTarget() ? renderer.pickElement(x, y) : null;
  if (el) {
    toggleElement(ctx, el, true);
    return;
  }
  const hit = renderer.picker.pickWorld(x, y);
  const o = hit?.id ? store.byId(hit.id) : undefined;
  if (o) commands.selectObject(o, false);
  else commands.clearSelection();
}
