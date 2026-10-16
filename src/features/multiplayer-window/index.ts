/**
 * The Multiplayer window: rooms (start, join, the one you are in), public rooms, the Gallery and settings. Nothing
 * happens on its own: no room is ever joined, and nothing published, unless the person asks for it.
 */
import { toast } from "@/ui/toast";
import { isOpen, onWindowToggled } from "@/ui/window";
import { wireActions } from "./actions";
import { gateBuilding } from "./build-gate";
import { onStart } from "./invite";
import type { MultiplayerDeps } from "./port";
import { renderWindow } from "./render";
import { refreshMine } from "./room-clicks";
import type { MpWindow } from "./state";
import { emptyState } from "./state";
import { createMultiplayerWindow } from "./view";

export type { MultiplayerDeps } from "./port";

function browsePublic(win: MpWindow, open: boolean): void {
  const s = win.deps.session;
  if (open && !win.state.stopBrowse && s.networkAllowed()) {
    win.state.stopBrowse = s.browsePublicRooms((rooms) => {
      win.state.publicRooms = rooms;
      if (win.state.tab === "public") win.render();
    });
  } else if (!open && win.state.stopBrowse) {
    win.state.stopBrowse();
    win.state.stopBrowse = null;
  }
}

function askedToBuild(win: MpWindow, id: string, name: string): void {
  toast(`${name} asks to build`, {
    label: "Let them",
    run: () => void win.deps.session.letBuild(id, true),
    holdMs: 15_000,
  });
}

export function mount(deps: MultiplayerDeps): void {
  const stage = deps.stage ?? document.getElementById("stage") ?? document.body;
  const win: MpWindow = {
    deps,
    body: createMultiplayerWindow(stage),
    state: emptyState(),
    render: () => {
      renderWindow(win);
      // the list of public rooms is kept while the window is open and we are online (consent may come any time)
      browsePublic(win, isOpen("mp"));
    },
  };
  wireActions(win);
  gateBuilding(deps);
  for (const event of ["room:changed", "room:joined", "identity:changed"] as const) deps.bus.on(event, win.render);
  deps.bus.on("room:left", () => void refreshMine(win));
  // the owner's "Undo damage" follows what people change
  let soon: ReturnType<typeof setTimeout> | null = null;
  deps.bus.on("world:changed", () => {
    if (soon || !deps.session.inRoom() || !deps.session.amOwner()) return;
    soon = setTimeout(() => {
      soon = null;
      win.render();
    }, 500);
  });
  deps.bus.on("room:ask", ({ id, name }) => askedToBuild(win, id, name));
  deps.bus.on("terms:accepted", () => onStart(win));
  deps.session.onRelayStatus(() => {
    if (win.state.tab === "public") win.render();
  });
  onWindowToggled((id, open) => {
    if (id !== "mp") return;
    win.render();
    if (open) void refreshMine(win);
  });
  win.render();
}
