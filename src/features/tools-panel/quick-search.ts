/** Quick search (/): type what you want to do, Enter uses the best match, Tab opens it in the Tools panel. */
import type { ToolDef } from "@/app/tools";
import { needReason } from "@/app/tool-needs";
import { esc } from "@/ui/dom";
import { openPanel, useTool } from "./actions";
import type { Panel } from "./panel";
import { searchTools } from "./search";
import { blockedBy } from "./usability";

const MAX_RESULTS = 12;
const MAX_WIDTH_PX = 420;
const EDGE_PX = 10;
const LIST_ROOM_PX = 360;
const KEY_MAX = 12;
const INPUT_HTML =
  '<input placeholder="What do you want to do? e.g. &quot;extrude&quot;, &quot;circle&quot;, &quot;connect&quot;" ' +
  'aria-label="Search tools" autocomplete="off"><ul role="listbox"></ul>';

let box: HTMLElement | null = null;

export const quickSearchOpen = (): boolean => !!box;

export function closeQuickSearch(): void {
  box?.remove();
  box = null;
}

/** with nothing typed: what works on the selection right now */
function results(p: Panel, query: string): ToolDef[] {
  if (query.trim()) return searchTools(p.tools(), query, p.categoryName);
  const store = p.deps.store;
  return p.tools().filter((t) => t.kind !== "create" && t.need !== "none" && !needReason(store, t.need));
}

function itemHtml(p: Panel, t: ToolDef, selected: boolean): string {
  const reason = blockedBy(p.deps.store, t);
  const key = t.key && t.key.length < KEY_MAX ? `<kbd>${esc(t.key)}</kbd>` : "<i></i>";
  return (
    `<li data-id="${t.id}" class="${reason ? "na" : ""}" aria-selected="${selected}">` +
    `<b>${esc(t.name)}</b>${key}<span>${esc(reason || t.summary)}</span></li>`
  );
}

function place(el: HTMLElement, stage: HTMLElement, x?: number, y?: number): void {
  const r = stage.getBoundingClientRect();
  const w = Math.min(MAX_WIDTH_PX, r.width - 2 * EDGE_PX);
  const left = Math.min((x ?? r.left + r.width / 2) - r.left - w / 2, r.width - w - EDGE_PX);
  const top = Math.min((y ?? r.top + r.height / 3) - r.top - 20, r.height - LIST_ROOM_PX);
  el.style.left = Math.max(EDGE_PX, left) + "px";
  el.style.top = Math.max(EDGE_PX, top) + "px";
}

interface Search {
  input: HTMLInputElement;
  ul: HTMLElement;
  ids: string[];
  index: number;
}

function render(p: Panel, s: Search): void {
  const found = results(p, s.input.value).slice(0, MAX_RESULTS);
  s.ids = found.map((t) => t.id);
  s.index = 0;
  s.ul.innerHTML =
    found.map((t, i) => itemHtml(p, t, i === 0)).join("") ||
    "<li><span>Nothing matches. Open the Tools panel (Ctrl+K) to browse everything.</span></li>";
}

function mark(s: Search): void {
  s.ul.querySelectorAll("li").forEach((li, i) => li.setAttribute("aria-selected", String(i === s.index)));
}

function choose(p: Panel, id: string | undefined, inPanel: boolean): void {
  closeQuickSearch();
  const t = id ? p.tool(id) : undefined;
  if (inPanel) openPanel(p, id);
  else if (t) useTool(p, t);
}

function onKey(p: Panel, s: Search, e: KeyboardEvent): void {
  const keys: Record<string, () => void> = {
    Escape: () => {
      closeQuickSearch();
      document.getElementById("view")?.focus();
    },
    ArrowDown: () => (s.index = Math.min(s.ids.length - 1, s.index + 1)),
    ArrowUp: () => (s.index = Math.max(0, s.index - 1)),
    Enter: () => choose(p, s.ids[s.index], false),
    Tab: () => choose(p, s.ids[s.index], true),
  };
  const run = keys[e.key];
  if (!run) return;
  e.preventDefault();
  run();
  mark(s);
}

export function openQuickSearch(p: Panel, x?: number, y?: number): void {
  closeQuickSearch();
  const stage = document.getElementById("stage")!;
  const el = document.createElement("div");
  el.className = "qs";
  el.setAttribute("role", "dialog");
  el.setAttribute("aria-label", "Search tools");
  el.innerHTML = INPUT_HTML;
  place(el, stage, x, y);
  stage.appendChild(el);
  box = el;
  const s: Search = { input: el.querySelector("input")!, ul: el.querySelector("ul")!, ids: [], index: 0 };
  s.input.addEventListener("input", () => render(p, s));
  s.input.addEventListener("keydown", (e) => onKey(p, s, e));
  s.ul.addEventListener("click", (e) => {
    const li = (e.target as HTMLElement).closest<HTMLElement>("li[data-id]");
    if (li) choose(p, li.dataset.id, false);
  });
  render(p, s);
  setTimeout(() => s.input.focus(), 0);
}

/** a press in the 3D view closes it (the viewport used to do this; now the search looks after itself) */
export function closeOnViewPress(): void {
  document.getElementById("view")?.addEventListener("pointerdown", closeQuickSearch, true);
}
