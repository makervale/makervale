/** The Tools panel's fixed markup and its filter chips. */
import type { Store } from "@/app/store";
import type { ToolDef } from "@/app/tools";
import type { Filter, PanelState } from "./state";
import { fits } from "./usability";

const SEARCH_ICON = `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="11" cy="11" r="7"/><path d="m20 20-4-4"/></svg>`;
const WIDE_ICON = `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M15 5 8 12l7 7"/></svg>`;
const CLOSE_ICON = `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M5 5l14 14M19 5 5 19"/></svg>`;

export const PANEL_HTML = `<div class="sb-top"><div class="search">${SEARCH_ICON}<input id="cat-q" placeholder="What are you looking for? e.g. &quot;round off&quot;, &quot;hole&quot;" autocomplete="off" aria-label="Search tools"></div><button class="ibtn" id="cat-wide" aria-pressed="false" title="Expand descriptions">${WIDE_ICON}</button><button class="ibtn" id="cat-close" title="Hide the tools (bring them back with the Tools button or Ctrl+K)">${CLOSE_ICON}</button></div>
    <div class="sb-filters" id="cat-filters"></div>
    <div class="sb-main"><div class="cat-list" id="cat-list" role="listbox" aria-label="Tools"></div><div class="cat-card" id="cat-card"></div></div>`;

interface Counts {
  all: number;
  fit: number;
  pinned: number;
  recent: number;
}

export function countsOf(store: Store, tools: ToolDef[], pins: string[], recent: string[]): Counts {
  return {
    all: tools.length,
    fit: tools.filter((t) => fits(store, t)).length,
    pinned: pins.length,
    recent: recent.length,
  };
}

export function filtersHtml(st: PanelState, n: Counts): string {
  const chip = (id: Filter, label: string) =>
    `<button data-filter="${id}" aria-pressed="${st.filter === id && !st.query}">${label}<span>${n[id]}</span></button>`;
  return chip("all", "All") + chip("fit", "Fits") + chip("pinned", "At hand") + chip("recent", "Recent");
}
