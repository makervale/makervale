/** The Gestures button in the bottom bar: a popup of gestures your avatar plays (everyone in the room sees them). */
import { showWindow } from "@/ui/window";
import type { GesturesDeps } from "./port";
import type { GesturesView } from "./view";
import { createGesturesView } from "./view";

export type { GesturesDeps } from "./port";

export function mount(deps: GesturesDeps): void {
  const bar = deps.bar ?? document.querySelector<HTMLElement>(".bottombar") ?? document.getElementById("stage")!;
  const view = createGesturesView(bar);
  const { button, menu } = view;
  button.addEventListener("click", () => setOpen(view, menu.hidden));
  menu.addEventListener("click", (e) => {
    const t = e.target as HTMLElement;
    const gesture = t.closest<HTMLElement>("[data-gesture]");
    if (gesture) deps.bus.emit("gesture:play", { name: gesture.dataset.gesture! });
    if (t.closest("[data-avwin]")) showWindow("avwin", true);
    setOpen(view, false);
    document.getElementById("view")?.focus();
  });
  // a press anywhere else closes the popup
  document.addEventListener("pointerdown", (e) => {
    if (!menu.hidden && !(e.target as HTMLElement).closest("#gest-menu, #gest-btn")) setOpen(view, false);
  });
}

function setOpen(view: GesturesView, open: boolean): void {
  view.menu.hidden = !open;
  view.button.setAttribute("aria-expanded", String(open));
}
