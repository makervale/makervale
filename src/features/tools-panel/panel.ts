/** The Tools panel's working set: its deps, state, elements, and the live preview on its card. */
import type { Params, ToolDef } from "@/app/tools";
import { $ } from "@/ui/dom";
import type { ToolsPanelDeps } from "./deps";
import type { DemoResult } from "@/render/preview/demo";
import type { PanelState } from "./state";
import { loadState, saveState } from "./state";
import { PANEL_HTML } from "./view";

export interface CardPreview {
  demo: DemoResult | null;
  /** parameter values set with the card's slider */
  over: Params;
  /** seconds of turning so far */
  turn: number;
  lastFrame: number;
  spinning: boolean;
  hoverTimer: number;
}

export interface Panel {
  deps: ToolsPanelDeps;
  st: PanelState;
  side: HTMLElement;
  list: HTMLElement;
  card: HTMLElement;
  query: HTMLInputElement;
  preview: CardPreview;
  /** the list's last markup: unchanged lists are not rebuilt (keeps hover and scroll) */
  lastList: string;
  tools(): ToolDef[];
  tool(id: string): ToolDef | undefined;
  categoryName(id: string): string;
  save(): void;
}

export function createPanel(deps: ToolsPanelDeps): Panel {
  const side = document.getElementById("catalog")!;
  side.innerHTML = PANEL_HTML;
  const st = loadState();
  return {
    deps,
    st,
    side,
    list: $("#cat-list", side),
    card: $("#cat-card", side),
    query: $<HTMLInputElement>("#cat-q", side),
    preview: { demo: null, over: {}, turn: 0, lastFrame: 0, spinning: false, hoverTimer: 0 },
    lastList: "",
    tools: () => deps.runner.tools.all(),
    tool: (id) => deps.runner.tools.get(id),
    categoryName: (id) => deps.categories.find((c) => c.id === id)?.name ?? id,
    save: () => saveState(st),
  };
}

/** the card is on screen: docked (wide) or popped over the view */
export const cardVisible = (p: Panel): boolean => p.st.wide || p.card.classList.contains("pop");

export function focusView(p: Panel): void {
  p.query.blur();
  document.getElementById("view")?.focus({ preventScroll: true });
}
