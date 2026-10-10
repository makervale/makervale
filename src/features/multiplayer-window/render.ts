/** Draw the window for where you are: the lobby outside rooms, the room's people and controls inside one. */
import { connectionHTML } from "./relay-view";
import { lobbyHTML } from "./lobby-view";
import { goOnlineHTML } from "./privacy-view";
import { renderMine, renderRooms, renderStatus, startBrowsing, stopBrowsing } from "./lists";
import { roomHTML } from "./room-view";
import type { MpWindow } from "./state";
import { updateBadge } from "./view";

export function renderWindow(win: MpWindow): void {
  const { session, identity, ice } = win.deps;
  const inRoom = session.inRoom();
  updateBadge(inRoom ? session.net.peers.size + 1 : null);
  const connection = connectionHTML(ice.turnPrefs(), win.state);
  if (inRoom) {
    stopBrowsing(win);
    win.body.innerHTML = roomHTML(identity, session, connection);
    return;
  }
  if (!win.deps.lobby.networkAllowed()) {
    // the privacy note comes first: until it is accepted the page contacts nobody
    win.body.innerHTML = goOnlineHTML(identity);
    return;
  }
  win.body.innerHTML = lobbyHTML(identity, connection);
  renderRooms(win);
  renderMine(win);
  renderStatus(win);
  startBrowsing(win);
}
