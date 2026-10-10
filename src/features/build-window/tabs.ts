/** The tabs: Object, Material, Script, Scene. Only the current one is drawn. */
import { $, $$ } from "@/ui/dom";
import type { Build, Clicks, Tab } from "./context";
import { materialTab } from "./material-tab";
import { objectTab } from "./object-tab";
import { sceneTab } from "./scene-tab";
import { renderScriptTab } from "./script-tab";
import { drawUV } from "./uv-map";

function nothingSelected(b: Build): string {
  const n = b.deps.store.world.objects.length;
  return (
    `<div class="empty">Nothing selected.<br>${n} objects in the scene.<br><br>Click an object or choose <b>Create</b>.` +
    "<br>All tools are in the <b>Tools</b> panel (Ctrl+K).</div>"
  );
}

export function renderTab(b: Build): void {
  for (const t of $$(".tab", b.root)) t.setAttribute("aria-selected", String(t.dataset.tab === b.tab));
  const el = $("#b-tab", b.root);
  const objs = b.deps.store.selected();
  if (b.tab === "scene") el.innerHTML = sceneTab(b);
  else if (b.tab === "script") renderScriptTab(b, el, objs);
  else if (!objs.length) el.innerHTML = nothingSelected(b);
  else if (b.tab === "obj") el.innerHTML = objectTab(b, objs);
  else {
    el.innerHTML = materialTab(b, objs);
    drawUV(el.querySelector("#uvmap"), objs[0], b.deps.store.selection.elements.faces);
  }
}

export const TAB_CLICKS: Clicks = [
  [
    ".tab",
    (b, el) => {
      b.tab = el.dataset.tab as Tab;
      b.scriptFor = "";
      renderTab(b);
    },
  ],
];
