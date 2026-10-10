/**
 * The menu bar (File, Edit, View, Tools, Help) and the Help, Privacy and Licenses windows it opens. Commands go to their owners: tools
 * and other features over the bus, undo and selection to commands, the camera to the renderer.
 */
import type { MenubarDeps } from "./deps";
import { HELP_HTML } from "./help-view";
import { LICENSES_HTML } from "./licenses-view";
import { PRIVACY_WINDOW_HTML } from "./privacy-view";
import { wireMenus } from "./menus";
import { commandRunner } from "./run-command";
import { MENUBAR_HTML } from "./view";
import { Wireframe } from "./wireframe";

export type { MenubarDeps } from "./deps";
export { BUILD } from "./run-command";

export function mount(deps: MenubarDeps): void {
  const bar = document.getElementById("menubar")!;
  bar.innerHTML = MENUBAR_HTML;
  document.getElementById("stage")!.insertAdjacentHTML("beforeend", HELP_HTML + PRIVACY_WINDOW_HTML + LICENSES_HTML);
  const wire = new Wireframe(deps.renderer.views);
  deps.bus.on("world:changed", () => {
    if (wire.on) wire.sync();
  });
  wireMenus(bar, commandRunner(deps, wire));
}
