/**
 * The Tools panel: a sidebar with every tool by category, search, pins and recent tools. Hovering a tool shows a
 * card with a live illustration; wide, the card is docked next to the list. Also the quick search popup (/).
 */
import { DESKTOP_ONLY_MESSAGE, isPhone } from "@/ui/device";
import { toast } from "@/ui/toast";
import { $$ } from "@/ui/dom";
import { openPanel, refreshAll, setHidden, toggleFromToolbar } from "./actions";
import { ensureSpin, renderCard } from "./card";
import type { ToolsPanelDeps } from "./deps";
import { wireEvents } from "./events";
import type { Panel } from "./panel";
import { cardVisible, createPanel } from "./panel";
import { closeOnViewPress, openQuickSearch } from "./quick-search";

export type { Category, ToolsPanelDeps } from "./deps";

/** what fits changed: lists and counts follow; an open card refreshes its "can I use it" line */
function refresh(p: Panel): void {
  refreshAll(p);
  if (cardVisible(p) && p.card.querySelector(".need")) renderCard(p);
}

function listen(p: Panel): void {
  const { bus, prefs } = p.deps;
  bus.on("selection:changed", () => refresh(p));
  bus.on("settings:changed", () => refresh(p));
  bus.on("mode:changed", () => refresh(p));
  bus.on("tool:use", ({ id }) => prefs.noteUsed(id));
  bus.on("search:open", ({ x, y }) => (isPhone() ? toast(DESKTOP_ONLY_MESSAGE) : openQuickSearch(p, x, y)));
  bus.on("menu:command", ({ command }) => {
    if (command.startsWith("catalog") && isPhone()) toast(DESKTOP_ONLY_MESSAGE);
    else if (command === "catalog") openPanel(p);
    else if (command.startsWith("catalog:")) openPanel(p, command.slice("catalog:".length));
  });
  prefs.onChange(() => {
    refreshAll(p);
    if (cardVisible(p)) renderCard(p);
  });
}

export function mount(deps: ToolsPanelDeps): void {
  const p = createPanel(deps);
  wireEvents(p);
  listen(p);
  for (const b of $$("[data-cat-toggle]")) b.addEventListener("click", () => toggleFromToolbar(p));
  closeOnViewPress();
  setHidden(p, p.st.hidden);
  refreshAll(p);
  if (!p.st.wide) return;
  renderCard(p);
  ensureSpin(p);
}
