/** Draws the pie: a ring of wedges (the one under the pointer lights up), labels on top, the title in the hole. */
import { esc } from "@/ui/dom";
import type { PieItem } from "./deps";
import { isBig, labelBox, outerRadius, pieCentre, slotCount, wedgePath } from "./geometry";

const MAX_ITEMS = 10;

function wedgesSvg(items: PieItem[], slots: number, outer: number): string {
  const paths = Array.from({ length: slots }, (_, i) => {
    const live = i < items.length && !items[i].disabled;
    return `<path d="${wedgePath(i, slots, outer)}" ${live ? `data-i="${i}" class="w"` : 'class="w empty"'}/>`;
  });
  const box = `left:${-outer}px;top:${-outer}px;width:${outer * 2}px;height:${outer * 2}px`;
  return `<svg class="wedges" viewBox="${-outer} ${-outer} ${outer * 2} ${outer * 2}" style="${box}">${paths.join("")}</svg>`;
}

function labelsHtml(items: PieItem[], slots: number, outer: number): string {
  return items
    .map((item, i) => {
      const b = labelBox(i, slots, outer);
      const style = `left:${b.left}px;top:${b.top}px;width:${b.width}px`;
      return `<button class="slice" data-i="${i}" data-s="${i}" style="${style}" ${item.disabled ? "disabled" : ""}>${esc(item.label)}</button>`;
    })
    .join("");
}

export function closePie(pie: HTMLElement): void {
  pie.hidden = true;
}

/** show the pie centred near (x, y) in client coordinates; a click on a wedge closes it and runs the item */
export function renderPie(pie: HTMLElement, x: number, y: number, title: string, all: PieItem[]): void {
  const items = all.slice(0, MAX_ITEMS);
  const stage = pie.parentElement!.getBoundingClientRect();
  const c = pieCentre(x - stage.left, y - stage.top, stage, items.length);
  pie.style.left = c.left + "px";
  pie.style.top = c.top + "px";
  pie.classList.toggle("big", isBig(items.length));
  const slots = slotCount(items.length);
  const outer = outerRadius(items.length);
  pie.innerHTML =
    '<div class="ring"></div>' +
    wedgesSvg(items, slots, outer) +
    `<div class="hole">${esc(title)}</div>` +
    labelsHtml(items, slots, outer);
  pie.onclick = (e) => {
    const b = (e.target as Element).closest("[data-i]");
    if (!b) return;
    closePie(pie);
    items[+b.getAttribute("data-i")!].run();
  };
  pie.hidden = false;
}

/** the wedge under the pointer lights its label; keyboard focus on a label lights its wedge */
export function wireHighlights(pie: HTMLElement): void {
  pie.addEventListener("pointerover", (e) => {
    const wedge = (e.target as Element).closest("path[data-i]");
    pie.querySelectorAll(".slice.hot").forEach((x) => x.classList.remove("hot"));
    if (wedge) pie.querySelector(`.slice[data-s="${wedge.getAttribute("data-i")}"]`)?.classList.add("hot");
  });
  pie.addEventListener("focusin", (e) => {
    const label = (e.target as HTMLElement).closest<HTMLElement>("[data-s]");
    pie.querySelectorAll("path.on").forEach((p) => p.classList.remove("on"));
    if (label) pie.querySelector(`path[data-i="${label.dataset.s}"]`)?.classList.add("on");
  });
}
