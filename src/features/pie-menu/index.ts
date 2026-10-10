/**
 * The pie menu: right-click without dragging (the viewport emits "pie:open"). While building it is filled with
 * what fits the selection; otherwise with what you can do in the world.
 */
import { el } from "@/ui/dom";
import { isOpen } from "@/ui/window";
import { buildPie } from "./build-items";
import type { PieDeps } from "./deps";
import { closePie, renderPie, wireHighlights } from "./view";
import { worldPie } from "./world-items";

export type { AvatarPort, PieDeps, TouchPort } from "./deps";

function createPie(): HTMLElement {
  const pie = el("div");
  pie.id = "pie";
  pie.hidden = true;
  document.getElementById("stage")!.appendChild(pie);
  return pie;
}

/** a press in the view closes the pie; so does Esc, and then Esc does nothing else */
function closeWhenDone(pie: HTMLElement): void {
  document.getElementById("view")?.addEventListener("pointerdown", () => closePie(pie), true);
  window.addEventListener(
    "keydown",
    (e) => {
      if (e.key !== "Escape" || pie.hidden) return;
      e.preventDefault();
      e.stopImmediatePropagation();
      closePie(pie);
    },
    true,
  );
}

export function mount(deps: PieDeps): void {
  const pie = createPie();
  wireHighlights(pie);
  closeWhenDone(pie);
  deps.bus.on("pie:open", ({ x, y }) => {
    const { title, items } = isOpen("build") ? buildPie(deps, x, y) : worldPie(deps, x, y);
    renderPie(pie, x, y, title, items);
  });
}
