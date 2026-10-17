/**
 * The Limits window: how close the scene is to the limits of space (app/space.ts) and of script time
 * (features/scripts/gas.ts). The same everywhere, alone or in a room. Opened from View, or from the stats line.
 */
import type { Bus } from "@/app/bus";
import { isOpen, showWindow } from "@/ui/window";
import type { Levels } from "./view";
import { limitsHTML } from "./view";

export interface LimitsDeps {
  bus: Bus;
  levels(): Levels;
  stage?: HTMLElement;
}

const REFRESH_MS = 500;

const CLOSE_ICON = `<svg viewBox="0 0 10 10" stroke="currentColor" stroke-width="1.6">
  <path d="M1 1l8 8M9 1 1 9"/></svg>`;

const WINDOW = `<section class="floater" id="limits" aria-label="Limits" hidden>
  <div class="fhead" data-drag>
    <span class="ft">Limits</span><button class="x" data-close="limits" title="Close">${CLOSE_ICON}</button>
  </div>
  <div class="fbody lim" id="limits-body"></div>
</section>`;

export function mount(deps: LimitsDeps): void {
  const stage = deps.stage ?? document.getElementById("stage") ?? document.body;
  stage.insertAdjacentHTML("beforeend", WINDOW);
  const body = stage.querySelector<HTMLElement>("#limits-body")!;
  let sandOn = false;
  let shown = "";
  const draw = () => {
    if (!isOpen("limits")) return;
    const html = limitsHTML(deps.levels(), sandOn);
    // only when something changed, so a click never lands on a box that is being replaced
    if (html !== shown) body.innerHTML = shown = html;
  };
  setInterval(draw, REFRESH_MS);
  deps.bus.on("sandmap:changed", ({ on }) => {
    sandOn = on;
    draw();
  });
  body.addEventListener("change", (e) => {
    const t = e.target as HTMLInputElement;
    if (t.id === "lim-sand") deps.bus.emit("sandmap:set", { on: t.checked });
  });
  const stats = document.getElementById("stats");
  if (stats) {
    stats.title = "Limits: how close this scene is to them";
    stats.addEventListener("click", () => {
      showWindow("limits", true);
      draw();
    });
  }
}
