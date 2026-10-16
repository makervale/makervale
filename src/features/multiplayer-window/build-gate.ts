/** Where you may not build (watching in a room, viewing a world), the Build window stays closed. */
import { toast } from "@/ui/toast";
import { isOpen, onWindowToggled, showWindow } from "@/ui/window";
import type { MultiplayerDeps } from "./port";

export function gateBuilding(deps: MultiplayerDeps): void {
  const gate = () => {
    if (deps.session.canIBuild() || !isOpen("build")) return;
    showWindow("build", false);
    toast(
      deps.session.net.viewing
        ? "You're viewing a world: make a copy to build on it."
        : "The owner hasn't let you build here.",
    );
  };
  onWindowToggled((id, open) => {
    if (id === "build" && open) gate();
  });
  deps.bus.on("build:allowed", gate);
}
