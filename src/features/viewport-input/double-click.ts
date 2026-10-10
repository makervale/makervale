/**
 * Double-click while building. Editing: an edge selects its loop (Shift: its ring), a vertex or face the whole
 * connected part, empty space leaves mesh editing. On an object: start editing its mesh. On the ground: aim the
 * camera there.
 */
import { edgeLoop, edgeRing } from "@/lib/mesh/edge-loops";
import { cloneSelection, emptySelection } from "@/lib/mesh/selection";
import { linked } from "@/lib/mesh/select-grow";
import type { ElementPick } from "@/render/preselect";
import type { Obj } from "@/world/model";
import { isOpen } from "@/ui/window";
import type { InputCtx } from "./state";
import { camModeFromMods } from "./state";

export function doubleClick(ctx: InputCtx, e: MouseEvent): void {
  if (camModeFromMods(e) || !isOpen("build")) return;
  const x = e.clientX;
  const y = e.clientY;
  const { store, renderer, commands } = ctx;
  const t = store.editTarget();
  if (t) {
    const el = renderer.pickElement(x, y);
    if (el) selectConnected(ctx, t, el, e.shiftKey);
    else if (renderer.picker.pickWorld(x, y)?.id !== t.id) commands.setMode("object");
    return;
  }
  const hit = renderer.picker.pickWorld(x, y);
  const o = hit?.id ? store.byId(hit.id) : undefined;
  if (o) {
    commands.selectObjects([o.id]);
    if (!o.locked) commands.setMode("auto");
  } else if (hit) {
    renderer.camera.setFocus(hit.point, null);
    commands.notice("Camera point set");
  }
}

function selectConnected(ctx: InputCtx, t: Obj, el: ElementPick, ring: boolean): void {
  const sel = cloneSelection(ctx.store.selection.elements);
  if (el.type === "e") {
    for (const k of ring ? edgeRing(t.mesh, el.id) : edgeLoop(t.mesh, el.id)) sel.edges.add(k);
  } else {
    const seed = emptySelection();
    if (el.type === "v") seed.verts.add(el.id);
    else seed.faces.add(el.id);
    const part = linked(t.mesh, seed);
    const into = el.type === "v" ? [part.verts, sel.verts] : [part.faces, sel.faces];
    for (const i of into[0]) into[1].add(i);
  }
  ctx.commands.setElements(sel);
}
