/** The Multiplayer window's frame, and the people count on its bottom-bar button. */
import { el } from "@/ui/dom";

const CLOSE_ICON = `<svg viewBox="0 0 10 10" stroke="currentColor" stroke-width="1.6">
  <path d="M1 1l8 8M9 1 1 9"/></svg>`;

const WINDOW = `<section class="floater" id="mp" aria-label="Multiplayer" hidden>
  <div class="fhead" data-drag>
    <span class="ft">Multiplayer</span><button class="x" data-close="mp" title="Close">${CLOSE_ICON}</button>
  </div>
  <div class="fbody mp" id="mp-body"></div>
</section>`;

/** adds the window to the stage; returns its body */
export function createMultiplayerWindow(stage: HTMLElement): HTMLElement {
  stage.insertAdjacentHTML("beforeend", WINDOW);
  return stage.querySelector<HTMLElement>("#mp-body")!;
}

/** how many are in the room, on the toolbar button; hidden outside rooms */
export function updateBadge(count: number | null): void {
  const button = document.querySelector<HTMLElement>('[data-win="mp"]');
  if (!button) return;
  let badge = button.querySelector<HTMLElement>(".count");
  if (!badge) badge = button.appendChild(el("span", "count"));
  badge.textContent = count === null ? "" : String(count);
  badge.hidden = count === null;
}
