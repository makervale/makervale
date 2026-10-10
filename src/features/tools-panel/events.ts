/** The Tools panel's clicks, keys and hovering. */
import type { ToolDef } from "@/app/tools";
import { goTo, refreshAll, setHidden, setWide, useTool } from "./actions";
import { onSlider, paint, popoverFor, renderCard, selectTool, sizeCanvases } from "./card";
import { tryExample } from "./example";
import { renderList } from "./list";
import type { Panel } from "./panel";
import { cardVisible } from "./panel";
import type { Filter } from "./state";

function clearSearch(p: Panel): void {
  p.query.value = "";
  p.st.query = "";
}

function onQueryKey(p: Panel, e: KeyboardEvent): void {
  if (e.key === "Enter") {
    const t = p.tool(p.st.id);
    if (t) useTool(p, t);
  } else if (e.key === "Escape") {
    clearSearch(p);
    refreshAll(p);
    p.query.blur();
    document.getElementById("view")?.focus();
  } else if (e.key === "ArrowDown" || e.key === "ArrowUp") {
    e.preventDefault();
    const items = [...p.list.querySelectorAll<HTMLElement>(".citem")];
    const i = items.findIndex((x) => x.dataset.id === p.st.id);
    const next = items[Math.max(0, Math.min(items.length - 1, i + (e.key === "ArrowDown" ? 1 : -1)))];
    if (!next) return;
    selectTool(p, next.dataset.id!, p.st.wide);
    next.scrollIntoView({ block: "nearest" });
  }
}

function onQueryInput(p: Panel): void {
  p.st.query = p.query.value;
  refreshAll(p);
  const first = p.list.querySelector<HTMLElement>(".citem");
  if (first && p.st.query) selectTool(p, first.dataset.id!, p.st.wide);
}

function toggleCategory(p: Panel, id: string): void {
  if (p.st.collapsed.has(id)) p.st.collapsed.delete(id);
  else p.st.collapsed.add(id);
  renderList(p);
  p.save();
}

function useCurrent(p: Panel): void {
  const t = p.tool(p.st.id);
  if (!t) return;
  useTool(p, t);
  refreshAll(p);
  renderCard(p);
}

function clickRow(p: Panel, row: HTMLElement): void {
  const t = p.tool(row.dataset.id!);
  if (!t) return;
  selectTool(p, t.id, p.st.wide);
  useTool(p, t);
  if (!p.st.wide) p.card.classList.remove("pop");
}

function clickRelated(p: Panel, id: string): void {
  withTool(p, id, (t) => {
    goTo(p, t);
    if (!p.st.wide) p.card.classList.add("pop");
  });
}

type ClickHandler = (p: Panel, el: HTMLElement) => void;

/** the first selector the click is inside decides what happens */
const CLICKS: [string, ClickHandler][] = [
  [
    "[data-filter]",
    (p, x) => {
      p.st.filter = x.dataset.filter as Filter;
      clearSearch(p);
      refreshAll(p);
    },
  ],
  [
    "#cat-wide",
    (p) => {
      p.card.classList.remove("pop");
      setWide(p, !p.st.wide);
      p.save();
    },
  ],
  [
    "#cat-close",
    (p) => {
      p.st.mobileOpen = false;
      p.side.classList.remove("open");
      setHidden(p, true);
    },
  ],
  ["h5[data-cat]", (p, x) => toggleCategory(p, x.dataset.cat!)],
  [".citem", clickRow],
  ["#cat-use", useCurrent],
  ["#cat-try", (p) => withTool(p, p.st.id, (t) => tryExample(p, t))],
  ["[data-pin]", (p, x) => p.deps.prefs.togglePin(x.dataset.pin!)],
  ["[data-go]", (p, x) => clickRelated(p, x.dataset.go!)],
];

function withTool(p: Panel, id: string, run: (t: ToolDef) => void): void {
  const t = p.tool(id);
  if (t) run(t);
}

function onClick(p: Panel, e: MouseEvent): void {
  const target = e.target as HTMLElement;
  for (const [selector, run] of CLICKS) {
    const x = target.closest<HTMLElement>(selector);
    if (x) {
      run(p, x);
      return;
    }
  }
}

export function wireEvents(p: Panel): void {
  p.query.addEventListener("input", () => onQueryInput(p));
  p.query.addEventListener("keydown", (e) => onQueryKey(p, e));
  p.side.addEventListener("click", (e) => onClick(p, e));
  p.list.addEventListener("pointerover", (e) => {
    if (e.pointerType === "touch") return;
    const row = (e.target as HTMLElement).closest<HTMLElement>(".citem");
    if (row) popoverFor(p, row);
  });
  p.list.addEventListener("pointerleave", () => popoverFor(p, null));
  p.card.addEventListener("pointerenter", () => clearTimeout(p.preview.hoverTimer));
  p.card.addEventListener("pointerleave", () => {
    if (!p.st.wide) popoverFor(p, null);
  });
  p.card.addEventListener("input", (e) => {
    const el = e.target as HTMLInputElement;
    if (el.id === "pv-param") onSlider(p, +el.value);
  });
  new ResizeObserver(() => {
    if (!cardVisible(p)) return;
    sizeCanvases(p);
    paint(p, 0);
  }).observe(p.card);
}
