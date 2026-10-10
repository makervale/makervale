/** The Gestures button and its popup: one button per gesture, and a way to the Avatar window. */
import { GESTURES } from "@/avatar/gestures";
import { esc } from "@/ui/dom";

const HAND_ICON = `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8"><path d="
  M8 13V5.5a1.5 1.5 0 0 1 3 0V12M11 11V4.5a1.5 1.5 0 0 1 3 0V12M14 11.5V6a1.5 1.5 0 0 1 3 0v8
  c0 4-2.5 7-6 7-2.5 0-4-1.2-5.5-3.5L3.8 14a1.5 1.5 0 0 1 2.5-1.6L8 15"/></svg>`;

function menuHTML(): string {
  const gestures = Object.entries(GESTURES).map(
    ([id, g]) => `<button class="btn small" data-gesture="${id}">${esc(g.label)}</button>`,
  );
  return gestures.join("") + `<button class="btn small" data-avwin>Avatar…</button>`;
}

const TEMPLATE = `<span class="gest">
  <button class="tbtn" id="gest-btn" aria-expanded="false" aria-haspopup="true"
    title="Gestures">${HAND_ICON}Gestures</button>
  <div class="gest-menu" id="gest-menu" hidden></div>
</span>`;

export interface GesturesView {
  button: HTMLElement;
  menu: HTMLElement;
}

/** in the bottom bar, the button sits between Avatar and Fly, as it always has */
export function createGesturesView(bar: HTMLElement): GesturesView {
  const flyButton = bar.querySelector("#av-btn");
  if (flyButton) flyButton.insertAdjacentHTML("beforebegin", TEMPLATE);
  else bar.insertAdjacentHTML("beforeend", TEMPLATE);
  const menu = bar.querySelector<HTMLElement>("#gest-menu")!;
  menu.innerHTML = menuHTML();
  return { button: bar.querySelector<HTMLElement>("#gest-btn")!, menu };
}
