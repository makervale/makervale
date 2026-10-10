/** The Build window's working set, shared by its parts. */
import type { Entry } from "@/world/history";
import type { BuildWindowDeps } from "./deps";
import { DragEdit } from "./drag-edit";

export type Tab = "obj" | "mat" | "script" | "scene";

export interface Build {
  deps: BuildWindowDeps;
  root: HTMLElement;
  tab: Tab;
  /** the material slot the Material tab edits */
  matSlot: number;
  /** whose script the editor holds; "" makes the Script tab rebuild */
  scriptFor: string;
  /** the tool run the last-operation panel adjusts */
  lastEntry: Entry | null;
  drag: DragEdit;
  /** redraw the current tab (set by the window once its parts are wired; parts call it after changing `tab`) */
  renderTab: () => void;
}

export function createBuild(deps: BuildWindowDeps, root: HTMLElement): Build {
  const drag = new DragEdit(deps);
  return { deps, root, tab: "obj", matSlot: 0, scriptFor: "", lastEntry: null, drag, renderTab: () => {} };
}

/** a form control in the window that fired "change" */
export type Field = HTMLInputElement | HTMLSelectElement;

export type ClickHandler = (b: Build, el: HTMLElement, e: MouseEvent) => void;

/** a click inside the window: the first selector it is inside decides */
export type Clicks = [string, ClickHandler][];

export function dispatchClick(b: Build, clicks: Clicks, e: MouseEvent): void {
  const target = e.target as HTMLElement;
  for (const [selector, run] of clicks) {
    const el = target.closest<HTMLElement>(selector);
    if (el && b.root.contains(el)) {
      run(b, el, e);
      return;
    }
  }
}
