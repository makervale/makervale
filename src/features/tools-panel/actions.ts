/** What the Tools panel does: use a tool, show the panel or put it away, jump to a tool. */
import type { ToolDef } from "@/app/tools";
import { $$ } from "@/ui/dom";
import { ensureSpin, renderCard, selectTool } from "./card";
import { renderList } from "./list";
import type { Panel } from "./panel";
import { focusView } from "./panel";
import { filtersHtml, countsOf } from "./view";

const PHONE = "(max-width:760px)";

export const isPhone = (): boolean => matchMedia(PHONE).matches;

/** using a tool is a request: whoever runs tools (live tool, runner) picks it up from the bus */
export function useTool(p: Panel, t: ToolDef): void {
  focusView(p);
  p.deps.bus.emit("tool:use", { id: t.id });
}

export function renderTop(p: Panel): void {
  const { st, side, deps } = p;
  const counts = countsOf(deps.store, p.tools(), deps.prefs.pinned, deps.prefs.recent);
  side.querySelector("#cat-filters")!.innerHTML = filtersHtml(st, counts);
  side.classList.toggle("wide", st.wide);
  const wide = side.querySelector<HTMLElement>("#cat-wide")!;
  wide.setAttribute("aria-pressed", String(st.wide));
  wide.title = st.wide ? "Collapse descriptions" : "Expand descriptions";
}

export function refreshAll(p: Panel): void {
  renderTop(p);
  renderList(p);
}

/** the whole panel can be put away (bottom-bar Tools button, its ✕, or Ctrl+K to bring it back) */
export function setHidden(p: Panel, hidden: boolean): void {
  p.st.hidden = hidden;
  p.side.classList.toggle("gone", hidden);
  for (const b of $$("[data-cat-toggle]")) b.setAttribute("aria-pressed", String(!hidden));
  p.save();
  window.dispatchEvent(new Event("resize"));
}

export function setWide(p: Panel, wide: boolean): void {
  if (p.st.wide === wide) return;
  p.st.wide = wide;
  renderTop(p);
  if (wide) {
    renderCard(p);
    ensureSpin(p);
  }
}

/** show a tool's row and card, clearing any search or filter that hides it */
export function goTo(p: Panel, t: ToolDef): void {
  p.st.query = "";
  p.query.value = "";
  p.st.filter = "all";
  p.st.collapsed.delete(t.category);
  refreshAll(p);
  selectTool(p, t.id, true);
  p.list.querySelector(`.citem[data-id="${t.id}"]`)?.scrollIntoView({ block: "nearest" });
}

/** open the panel (Ctrl+K, menus): on a tool's card, or with the cursor in the search box */
export function openPanel(p: Panel, id?: string): void {
  if (p.st.hidden) setHidden(p, false);
  if (isPhone()) {
    p.st.mobileOpen = true;
    p.side.classList.add("open");
  }
  const t = id ? p.tool(id) : undefined;
  if (t) goTo(p, t);
  setWide(p, true);
  ensureSpin(p);
  if (!t) setTimeout(() => p.query.focus(), 0);
  p.save();
}

export function toggleFromToolbar(p: Panel): void {
  if (!isPhone()) {
    setHidden(p, !p.st.hidden);
    return;
  }
  p.st.mobileOpen = !p.st.mobileOpen;
  p.side.classList.toggle("open", p.st.mobileOpen);
}
