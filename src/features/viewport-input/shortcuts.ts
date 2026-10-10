/** Single-key shortcuts while building, and what Delete and Escape mean right now. */
import { emptySelection, selectionCount } from "@/lib/mesh/selection";
import type { InputCtx } from "./state";

/** key (with "ctrl+" / "shift+" in front) → tool id; only while building */
export const TOOL_KEYS: Record<string, string> = {
  e: "extrude",
  i: "inset",
  m: "merge",
  j: "connect",
  l: "linked",
  h: "hide",
  "shift+h": "unhide",
  "+": "grow",
  "=": "grow",
  "-": "shrink",
  "ctrl+d": "duplicate",
  "ctrl+j": "join",
  "ctrl+g": "group",
  "ctrl+shift+g": "ungroup",
  "ctrl+a": "selall",
  "ctrl+i": "invert",
  "ctrl+r": "loopcut",
  b: "bevel",
  k: "knife",
  "shift+b": "bridge",
};

/** Shift counts in a combo only with Ctrl, or for the keys whose Shift version is a different tool */
export function comboOf(k: string, cmd: boolean, shift: boolean): string {
  const shifted = shift && (cmd || k === "h" || k === "b");
  return (cmd ? "ctrl+" : "") + (shifted ? "shift+" : "") + k;
}

/** Delete: the selected faces, edges or vertices while editing, otherwise the selected objects */
export function deleteToolId(ctx: InputCtx): string {
  if (!ctx.store.editTarget()) return "delete";
  const s = ctx.store.selection.elements;
  if (s.faces.size) return "delfaces";
  return s.edges.size ? "deledges" : "delverts";
}

/** Escape steps back one thing at a time: the drag, the elements, the mode, create, the selection, the camera */
export function escape(ctx: InputCtx): void {
  const { store, commands, manip, renderer } = ctx;
  if (ctx.live.active()) ctx.live.cancel();
  else if (manip.drag) {
    manip.cancel();
    ctx.track = null;
  } else if (store.editTarget() && selectionCount(store.selection.elements)) commands.setElements(emptySelection());
  else if (store.selection.mode !== "object") commands.setMode("object");
  else if (store.toolMode === "create") commands.setToolMode("edit");
  else if (store.selection.objects.size) commands.clearSelection();
  else if (!renderer.camera.follow) {
    renderer.camera.follow = true;
    commands.notice("Camera behind the avatar");
  } else renderer.framing.home(store.visibleObjects());
}
