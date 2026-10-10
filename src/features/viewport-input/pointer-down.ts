/**
 * A press in the view. Building: select, grab handles or elements, place new objects, box-select. Not building:
 * a click touches scripted objects and a drag turns the camera. Right button: orbit, or the pie menu on a click.
 */
import type { Obj } from "@/world/model";
import { isOpen } from "@/ui/window";
import { placeAt, toggleElement, touchAt } from "./select";
import type { InputCtx } from "./state";
import { camModeFromMods, capture, setMods } from "./state";

const BUTTON = { left: 0, middle: 1, right: 2 };

export function mouseDown(ctx: InputCtx, e: PointerEvent): void {
  setMods(ctx, e);
  const x = e.clientX;
  const y = e.clientY;
  ctx.live.noteCursor(x, y);
  if (ctx.live.active() && !camModeFromMods(e)) {
    liveDown(ctx, e);
    return;
  }
  if (e.button === BUTTON.right || e.button === BUTTON.middle) {
    const right = e.button === BUTTON.right;
    capture(ctx, e.pointerId, x, y, { type: "cam", mode: right ? "orbit" : "pan", pie: right });
    e.preventDefault();
    return;
  }
  if (e.button !== BUTTON.left) return;
  if (cameraKeysDown(ctx, e)) return;
  if (!isOpen("build")) {
    if (!touchAt(ctx, x, y)) capture(ctx, e.pointerId, x, y, { type: "cam", mode: "orbit" });
    return;
  }
  buildingDown(ctx, e);
}

/** a tool is active: left confirms (or picks), right takes it back, middle pans */
function liveDown(ctx: InputCtx, e: PointerEvent): void {
  e.preventDefault();
  if (e.button === BUTTON.left) ctx.live.click(e.clientX, e.clientY);
  else if (e.button === BUTTON.right) ctx.live.cancel();
  else if (e.button === BUTTON.middle) capture(ctx, e.pointerId, e.clientX, e.clientY, { type: "cam", mode: "pan" });
}

/** Alt (+Ctrl, +Shift) turns the mouse into the camera; Alt+click sets the point the camera swings around */
function cameraKeysDown(ctx: InputCtx, e: PointerEvent): boolean {
  const mode = camModeFromMods(e);
  if (!mode) return false;
  const h = ctx.renderer.picker.pickWorld(e.clientX, e.clientY);
  if (mode === "zoom" && h) ctx.renderer.camera.setFocus(h.point, h.id);
  const valid = !!h || mode !== "zoom";
  capture(ctx, e.pointerId, e.clientX, e.clientY, { type: "cam", mode, valid });
  if (!valid) ctx.canvas.className = "c-no";
  return true;
}

function buildingDown(ctx: InputCtx, e: PointerEvent): void {
  const { store, manip } = ctx;
  const x = e.clientX;
  const y = e.clientY;
  if (store.toolMode === "create") {
    placeAt(ctx, x, y);
    return;
  }
  const handle = manip.mode() ? manip.pickHandle(x, y) : null;
  if (handle) {
    manip.startHandle(handle, x, y, e.shiftKey);
    capture(ctx, e.pointerId, x, y, null);
    return;
  }
  const target = store.editTarget();
  if (target) editingDown(ctx, e, target);
  else objectsDown(ctx, e);
}

/** editing a mesh: press an element to select and drag it; Shift adds or pulls; elsewhere box-selects */
function editingDown(ctx: InputCtx, e: PointerEvent, t: Obj): void {
  const { renderer, manip, commands, store } = ctx;
  const x = e.clientX;
  const y = e.clientY;
  const el = renderer.pickElement(x, y);
  if (el && e.shiftKey) {
    capture(ctx, e.pointerId, x, y, { type: "pull", el, hit: renderer.picker.pickWorld(x, y, t.id) });
    return;
  }
  if (el) {
    toggleElement(ctx, el, false);
    if (t.locked) return;
    const hitPoint = renderer.picker.pickWorld(x, y, t.id)?.point ?? manip.pivotOf([t]);
    manip.startGrab({ hitPoint, x, y, shift: false, elem: true });
    capture(ctx, e.pointerId, x, y, null);
    return;
  }
  const hit = renderer.picker.pickWorld(x, y);
  const other = hit?.id && hit.id !== t.id ? store.byId(hit.id) : undefined;
  if (other) commands.selectObject(other, e.shiftKey);
  else capture(ctx, e.pointerId, x, y, { type: "box", objects: false, shift: e.shiftKey });
}

/** objects: click selects (Shift adds), press and drag moves; on nothing, a drag box-selects */
function objectsDown(ctx: InputCtx, e: PointerEvent): void {
  const { renderer, store, commands, manip } = ctx;
  const x = e.clientX;
  const y = e.clientY;
  const hit = renderer.picker.pickWorld(x, y);
  const o = hit?.id ? store.byId(hit.id) : undefined;
  if (!hit || !o) {
    if (!e.shiftKey) commands.clearSelection();
    capture(ctx, e.pointerId, x, y, { type: "box", objects: true, shift: e.shiftKey });
    return;
  }
  if (e.shiftKey) {
    commands.selectObject(o, true);
    return;
  }
  if (!store.selection.objects.has(o.id)) commands.selectObject(o, false);
  if (store.selected().some((s) => s.locked)) return;
  manip.startGrab({ hitPoint: hit.point, x, y, shift: false, elem: false });
  capture(ctx, e.pointerId, x, y, null);
}
