/** When only the host may build, the Build window stays closed for everyone else. */
import { toast } from "@/ui/toast";
import { isOpen, onWindowToggled, showWindow } from "@/ui/window";
import type { MultiplayerDeps } from "./port";

export function gateBuilding(deps: MultiplayerDeps): void {
  const gate = () => {
    if (deps.session.canIBuild() || !isOpen("build")) return;
    showWindow("build", false);
    toast("Only the host can build in this room.");
  };
  onWindowToggled((id, open) => {
    if (id === "build" && open) gate();
  });
  deps.bus.on("build:allowed", gate);
}
