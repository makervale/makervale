/** The press ends: drop a drag, finish a box selection, or treat it as a click (the pie menu, a camera point). */
import * as THREE from "three";
import { cloneSelection, emptySelection } from "@/lib/mesh/selection";
import type { Rect } from "@/render/pick-rect";
import { rectBetween } from "./rubber";
import { addElements, toggleElement } from "./select";
import type { BoxDrag, CamDrag, InputCtx, Track } from "./state";

export function mouseUp(ctx: InputCtx): void {
  const t = ctx.track;
  const d = ctx.view;
  ctx.track = null;
  ctx.view = null;
  if (ctx.manip.drag) {
    ctx.manip.end();
    return;
  }
  ctx.canvas.className = "";
  if (!t || !d) return;
  if (d.type === "pull" && !t.moved) toggleElement(ctx, d.el, true);
  else if (d.type === "cam") cameraUp(ctx, d, t);
  else if (d.type === "box") boxUp(ctx, d, t);
}

/** a camera drag that didn't move is a click: the pie menu (right button) or a camera point (Alt) */
function cameraUp(ctx: InputCtx, d: CamDrag, t: Track): void {
  if (ctx.live.active()) ctx.live.rebase();
  else if (t.moved) return;
  else if (d.pie) ctx.bus.emit("pie:open", { x: t.sx, y: t.sy });
  else if (d.mode === "zoom" && d.valid) ctx.commands.notice("Camera point set");
}

function boxUp(ctx: InputCtx, d: BoxDrag, t: Track): void {
  ctx.rubber.hide();
  const { store, commands } = ctx;
  if (!t.moved) {
    // a click on nothing while editing drops the element selection
    if (!d.objects && store.editTarget() && !d.shift) commands.setElements(emptySelection());
    return;
  }
  const r = rectBetween(t.sx, t.sy, t.x, t.y);
  if (d.objects) selectObjectsIn(ctx, r);
  else {
    const sel = d.shift ? cloneSelection(store.selection.elements) : emptySelection();
    addElements(sel, ctx.renderer.elementsInRect(r));
    commands.setElements(sel);
  }
}

/** objects whose origin is inside the box join the selection */
function selectObjectsIn(ctx: InputCtx, r: Rect): void {
  const ids = new Set(ctx.store.selection.objects);
  for (const o of ctx.store.visibleObjects()) {
    const s = ctx.renderer.picker.screenOf(new THREE.Vector3().fromArray(o.pos));
    if (s.z <= 1 && s.x >= r.x0 && s.x <= r.x1 && s.y >= r.y0 && s.y <= r.y1) ids.add(o.id);
  }
  ctx.commands.selectObjects([...ids]);
}
