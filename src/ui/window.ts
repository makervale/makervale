/**
 * Floating windows (`.floater`): show / hide, drag by the header (`[data-drag]`), bring to front on click.
 * Buttons with `data-win="id"` toggle a window and show its state; `data-close="id"` closes it.
 */
import { $$, clamp } from "./dom";

export type WindowListener = (id: string, open: boolean) => void;

const KEEP_VISIBLE_PX = { x: 60, y: 40 };
const listeners = new Set<WindowListener>();

export function onWindowToggled(listener: WindowListener): () => void {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

export function isOpen(id: string): boolean {
  const w = document.getElementById(id);
  return !!w && !w.hidden;
}

/** open, close, or (without `open`) toggle a window */
export function showWindow(id: string, open?: boolean): void {
  const w = document.getElementById(id);
  if (!w) return;
  w.hidden = open === undefined ? !w.hidden : !open;
  if (!w.hidden) focusWindow(w);
  for (const b of $$("[data-win]")) b.setAttribute("aria-pressed", String(isOpen(b.dataset.win!)));
  for (const listener of listeners) listener(id, !w.hidden);
}

function focusWindow(w: HTMLElement): void {
  for (const other of $$(".floater")) other.classList.remove("focus");
  w.classList.add("focus");
}

export function initWindows(): void {
  for (const b of $$("[data-close]")) b.addEventListener("click", () => showWindow(b.dataset.close!, false));
  for (const b of $$("[data-win]")) b.addEventListener("click", () => showWindow(b.dataset.win!));
  for (const w of $$(".floater")) w.addEventListener("pointerdown", () => focusWindow(w));
  for (const handle of $$("[data-drag]")) handle.addEventListener("pointerdown", (e) => startDrag(handle, e));
}

function startDrag(handle: HTMLElement, e: PointerEvent): void {
  if ((e.target as HTMLElement).closest("button")) return;
  const w = handle.closest<HTMLElement>(".floater")!;
  const stage = document.getElementById("stage")!.getBoundingClientRect();
  const r = w.getBoundingClientRect();
  // windows docked to both edges (phone layout) keep their size once they come loose
  w.style.width = r.width + "px";
  handle.setPointerCapture(e.pointerId);
  const grab = { x: e.clientX - r.left, y: e.clientY - r.top };
  const move = (ev: PointerEvent) => {
    w.style.left = clamp(ev.clientX - grab.x - stage.left, 0, stage.width - KEEP_VISIBLE_PX.x) + "px";
    w.style.top = clamp(ev.clientY - grab.y - stage.top, 0, stage.height - KEEP_VISIBLE_PX.y) + "px";
    w.style.right = "auto";
    w.style.bottom = "auto";
  };
  const up = () => {
    window.removeEventListener("pointermove", move);
    window.removeEventListener("pointerup", up);
  };
  window.addEventListener("pointermove", move);
  window.addEventListener("pointerup", up);
  e.preventDefault();
}
