/** The tool list: grouped by category, or search results, pins, recent; thumbnails fill in while idle. */
import type { ToolDef } from "@/app/tools";
import { esc } from "@/ui/dom";
import type { Panel } from "./panel";
import { cachedThumbnail, thumbnail } from "@/render/preview/thumbs";
import { searchTools } from "./search";
import { blockedBy, fits } from "./usability";

const THUMB_PX = 56;
const IDLE_TIMEOUT_MS = 120;
const FALLBACK_TICK_MS = 16;
const KEY_MAX = 14;

interface Group {
  id: string;
  head: string;
  tools: ToolDef[];
}

function byIds(p: Panel, ids: string[]): ToolDef[] {
  return ids.map((id) => p.tool(id)).filter((t): t is ToolDef => !!t);
}

export function groups(p: Panel): Group[] {
  const { st, deps } = p;
  if (st.query.trim()) return [{ id: "q", head: "Results", tools: searchTools(p.tools(), st.query, p.categoryName) }];
  if (st.filter === "pinned") return [{ id: "pinned", head: "At hand", tools: byIds(p, deps.prefs.pinned) }];
  if (st.filter === "recent") return [{ id: "recent", head: "Recent", tools: byIds(p, deps.prefs.recent) }];
  const all = p.tools();
  return deps.categories
    .map((c) => ({
      id: c.id,
      head: c.name,
      tools: all.filter((t) => t.category === c.id && (st.filter === "all" || fits(deps.store, t))),
    }))
    .filter((g) => g.tools.length);
}

function emptyText(p: Panel): string {
  if (p.st.query) {
    return `Nothing matches "${esc(p.st.query)}". Describe what you want to do, e.g. "hole", "round off", "connect".`;
  }
  if (p.st.filter === "fit")
    return "Select an object or mesh elements, and the tools that work on them will show up here.";
  return "Empty.";
}

function itemHtml(p: Panel, t: ToolDef): string {
  const reason = blockedBy(p.deps.store, t);
  const thumb = cachedThumbnail(t.id, THUMB_PX);
  const key = t.key && t.key.length < KEY_MAX ? `<kbd>${esc(t.key)}</kbd>` : "";
  const on = t.kind === "option" && t.isOn?.();
  const state =
    t.kind === "option"
      ? `<span class="note">${on ? "on" : "off"}</span>`
      : `<span class="fit ${reason ? "no" : ""}" title="${reason ? esc(reason) : "Can be used now"}"></span>`;
  return (
    `<div class="citem ${reason ? "na" : ""}" role="option" data-id="${t.id}" aria-selected="${t.id === p.st.id}">` +
    `<img alt="" data-thumb="${t.id}"${thumb ? ` src="${thumb}"` : ""}>` +
    `<div class="nm"><span>${esc(t.name)}</span>${key}</div>${state}</div>`
  );
}

function listHtml(p: Panel): string {
  const gs = groups(p);
  const { st } = p;
  let html = gs.every((g) => !g.tools.length) ? `<div class="cat-empty">${emptyText(p)}</div>` : "";
  for (const g of gs) {
    const collapsed = st.collapsed.has(g.id) && !st.query && st.filter === "all";
    if (gs.length > 1 || st.query) {
      html += `<h5 data-cat="${g.id}" aria-expanded="${!collapsed}"><span>${esc(g.head)}</span><i>${g.tools.length}</i></h5>`;
    }
    if (!collapsed) html += g.tools.map((t) => itemHtml(p, t)).join("");
  }
  return html;
}

export function renderList(p: Panel): void {
  const html = listHtml(p);
  if (html === p.lastList) return;
  p.lastList = html;
  p.list.innerHTML = html;
  queueThumbnails(p);
}

/* thumbnails are drawn one at a time while the browser is idle, so the list appears at once */
let queue: HTMLImageElement[] = [];
let busy = false;

function queueThumbnails(p: Panel): void {
  queue = [...p.list.querySelectorAll<HTMLImageElement>("img[data-thumb]:not([src])")];
  if (!busy) pump(p);
}

function later(f: () => void): void {
  if (window.requestIdleCallback) window.requestIdleCallback(f, { timeout: IDLE_TIMEOUT_MS });
  else setTimeout(f, FALLBACK_TICK_MS);
}

function pump(p: Panel): void {
  const img = queue.shift();
  busy = !!img;
  if (!img) return;
  const t = p.tool(img.dataset.thumb!);
  if (t && img.isConnected) {
    try {
      img.src = thumbnail(t, THUMB_PX);
      p.lastList = "";
    } catch {
      /* a demo that can't be drawn keeps an empty square */
    }
  }
  later(() => pump(p));
}
