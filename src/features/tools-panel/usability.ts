/** Whether a tool can be used on the current selection, and how it is driven in the view. */
import type { Store } from "@/app/store";
import { needReason } from "@/app/tool-needs";
import type { ToolDef } from "@/app/tools";

/** creating, options and modes work any time; they never wait for a selection */
export const alwaysUsable = (t: ToolDef): boolean => t.kind === "create" || t.kind === "option" || t.kind === "mode";

/** why the tool can't be used now, or null */
export const blockedBy = (store: Store, t: ToolDef): string | null =>
  alwaysUsable(t) ? null : needReason(store, t.need);

export const usable = (store: Store, t: ToolDef): boolean => !blockedBy(store, t);

/** "Fits": tools that work on exactly what is selected now */
export const fits = (store: Store, t: ToolDef): boolean =>
  !alwaysUsable(t) && t.need !== "none" && !needReason(store, t.need);

/** what the mouse and wheel do while a live tool runs, e.g. "mouse: width · wheel: segments" */
export function liveNote(t: ToolDef): string {
  if (!t.live) return "";
  const params = t.params ?? [];
  const mouse = params.find((d) => d.key === t.live!.param);
  const wheel = params.find((d) => d.key === t.live!.wheel);
  const bits: string[] = [];
  if (t.live.pick === "knife") bits.push("click edges");
  else if (t.live.pick === "edge") bits.push("click an edge");
  if (mouse) bits.push("mouse: " + mouse.label.toLowerCase());
  if (wheel) bits.push("wheel: " + wheel.label.toLowerCase());
  return bits.join(" · ");
}
