/**
 * The Multiplayer window: who you are, open or join a room, your saved rooms, the public room list, the people in
 * your room and the host's controls, your own TURN relay and the connection test. Nothing happens on its own:
 * no room is ever proposed or joined unless the person asks for it.
 */
import { onWindowToggled } from "@/ui/window";
import { gateBuilding } from "./build-gate";
import { refreshMine, renderStatus, startBrowsing, stopBrowsing } from "./lists";
import type { MultiplayerDeps } from "./port";
import { wireActions } from "./actions";
import { renderWindow } from "./render";
import type { MpWindow } from "./state";
import { emptyState } from "./state";
import { createMultiplayerWindow } from "./view";

export type { MultiplayerDeps } from "./port";

export function mount(deps: MultiplayerDeps): void {
  const stage = deps.stage ?? document.getElementById("stage") ?? document.body;
  const win: MpWindow = {
    deps,
    body: createMultiplayerWindow(stage),
    state: emptyState(),
    render: () => renderWindow(win),
  };
  wireActions(win);
  gateBuilding(deps);
  for (const event of ["room:changed", "room:joined", "room:left", "identity:changed"] as const) {
    deps.bus.on(event, win.render);
  }
  deps.lobby.onRelayStatus(() => {
    if (!deps.session.inRoom()) renderStatus(win);
  });
  onWindowToggled((id, open) => {
    if (id !== "mp") return;
    if (!open) {
      stopBrowsing(win);
      return;
    }
    win.render();
    startBrowsing(win);
    void refreshMine(win);
  });
  win.render();
}
