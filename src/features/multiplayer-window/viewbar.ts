/**
 * While you look at a world from the Gallery, a bar over the view says so, with the two ways out: make a copy to
 * build on, or close it and get your own scene back. Without it, it would be easy to forget whose scene this is.
 */
import { esc } from "@/ui/dom";
import type { MpWindow } from "./state";

function bar(stage: HTMLElement): HTMLElement {
  let el = document.getElementById("mp-viewbar");
  if (!el) {
    el = document.createElement("div");
    el.id = "mp-viewbar";
    el.className = "mp-viewbar";
    stage.appendChild(el);
  }
  return el;
}

export function renderViewBar(win: MpWindow): void {
  const v = win.deps.session.net.viewing;
  const stage = win.body.closest<HTMLElement>("#stage") ?? win.deps.stage ?? document.body;
  const el = bar(stage);
  el.hidden = !v;
  if (!v) return;
  const older = v.version < v.latest ? ` <span class="note">(newest is v${v.latest})</span>` : "";
  el.innerHTML = `<span>Viewing <b>${esc(v.title)}</b> v${v.version} by ${esc(v.by)}${older}</span>
    <button class="btn small" data-viewbar="copy">Make a copy</button>
    <button class="btn small primary" data-viewbar="close">Back to my scene</button>`;
}
