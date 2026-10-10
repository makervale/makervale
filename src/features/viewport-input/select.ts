/** What a click does to the selection: pick an object or an element, place a new object, touch a scripted one. */
import type { ElementSelection } from "@/lib/mesh/selection";
import { cloneSelection, emptySelection } from "@/lib/mesh/selection";
import type { ElementPick } from "@/render/preselect";
import type { InputCtx } from "./state";

/** an element click: alone it replaces the selection (unless already in it), `additive` toggles it */
export function toggleElement(ctx: InputCtx, p: ElementPick, additive: boolean): void {
  const current = ctx.store.selection.elements;
  const had = hasPick(current, p);
  if (!additive && had) return;
  const sel = additive ? cloneSelection(current) : emptySelection();
  setPick(sel, p, !(additive && had));
  ctx.commands.setElements(sel);
}

function hasPick(s: ElementSelection, p: ElementPick): boolean {
  if (p.type === "v") return s.verts.has(p.id);
  if (p.type === "e") return s.edges.has(p.id);
  return s.faces.has(p.id);
}

function setPick(s: ElementSelection, p: ElementPick, on: boolean): void {
  if (p.type === "v") {
    if (on) s.verts.add(p.id);
    else s.verts.delete(p.id);
  } else if (p.type === "e") {
    if (on) s.edges.add(p.id);
    else s.edges.delete(p.id);
  } else if (on) s.faces.add(p.id);
  else s.faces.delete(p.id);
}

/** add picked elements to a selection */
export function addElements(sel: ElementSelection, picks: Iterable<ElementPick>): void {
  for (const p of picks) setPick(sel, p, true);
}

/** create mode: the new object goes where you clicked, on the ground or on a face */
export function placeAt(ctx: InputCtx, x: number, y: number): void {
  const hit = ctx.renderer.picker.pickWorld(x, y);
  if (!hit) return;
  const { store, runner, commands } = ctx;
  const placement = { at: hit.point.toArray(), normal: hit.normal.toArray() };
  runner.run(store.createType, store.createParams[store.createType], placement);
  if (!store.settings.stayInCreate) commands.setToolMode("edit");
}

/** not building: a click on a scripted object touches it; true when it did */
export function touchAt(ctx: InputCtx, x: number, y: number): boolean {
  const h = ctx.renderer.picker.pickWorld(x, y);
  const o = h?.id ? ctx.store.byId(h.id) : undefined;
  if (!o || !ctx.scripts.touchable(o)) return false;
  ctx.bus.emit("object:touched", { id: o.id });
  return true;
}

/** is there a touchable object under the cursor (for the pointing-hand cursor)? */
export function touchableAt(ctx: InputCtx, x: number, y: number): boolean {
  const h = ctx.renderer.picker.pickWorld(x, y);
  const o = h?.id ? ctx.store.byId(h.id) : undefined;
  return !!o && ctx.scripts.touchable(o);
}
