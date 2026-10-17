/** Draw the window: the consent screen until you agree, then the tabs and the page of the one that is open. */
import { galleryHTML } from "./gallery-view";
import { goOnlineHTML } from "./privacy-view";
import { publicHTML } from "./public-view";
import { roomHTML } from "./room-view";
import { roomsHTML } from "./rooms-view";
import { settingsHTML } from "./settings-view";
import type { MpWindow } from "./state";
import { tabsHTML } from "./tabs-view";
import { updateBadge } from "./view";
import { renderViewBar } from "./viewbar";

function pageHTML(win: MpWindow): string {
  const { session, identity } = win.deps;
  const s = win.state;
  switch (s.tab) {
    case "public":
      return publicHTML(s.publicRooms, session.relayStatus(), session.inRoom() ? session.net.id : "");
    case "gallery":
      return galleryHTML(s, session.canPublish());
    case "settings":
      return settingsHTML(identity, session.turnPrefs(), s);
    default:
      return session.inRoom()
        ? roomHTML(identity.name, identity.look.shirt, session, win.deps.scriptShare, s.folds)
        : roomsHTML(identity, s.mine, s.invite);
  }
}

/** an open field keeps what was typed (and the focus) while the rest of the page redraws */
function keepTyping(body: HTMLElement, draw: () => void): void {
  const fields = [...body.querySelectorAll<HTMLInputElement | HTMLTextAreaElement>("input.tf, textarea.tf")];
  const values = new Map(fields.map((f) => [f.id, f.value]));
  const focused = document.activeElement?.id ?? "";
  draw();
  for (const [id, value] of values) {
    const f = body.querySelector<HTMLInputElement>("#" + id);
    if (f && id) f.value = value;
  }
  if (focused) body.querySelector<HTMLElement>("#" + focused)?.focus();
}

export function renderWindow(win: MpWindow): void {
  const { session, identity } = win.deps;
  updateBadge(session.inRoom() ? session.net.peers.size + 1 : null);
  renderViewBar(win);
  if (!session.networkAllowed()) {
    // the privacy note comes first: until it is accepted the page contacts nobody
    win.body.innerHTML = goOnlineHTML(identity);
    return;
  }
  keepTyping(win.body, () => {
    win.body.innerHTML = tabsHTML(win.state.tab, session.inRoom()) + `<div class="mp-page">${pageHTML(win)}</div>`;
  });
}
