/**
 * Coming in through a link (…#room=abcd-efgh-jkmn): the window opens with the invitation, and nothing is joined until
 * the person says so. Coming back after a reload: the room this tab was in is joined again, since being in it was
 * the person's choice and a reload is not leaving.
 */
import { toast } from "@/ui/toast";
import { showWindow } from "@/ui/window";
import { invitedCode } from "@/net";
import type { MpWindow } from "./state";

const TAB_ROOM = "mv.room";

function tabRoom(): string | null {
  try {
    return sessionStorage.getItem(TAB_ROOM);
  } catch {
    return null;
  }
}

function setTabRoom(code: string | null): void {
  try {
    if (code) sessionStorage.setItem(TAB_ROOM, code);
    else sessionStorage.removeItem(TAB_ROOM);
  } catch {
    // without storage a reload simply doesn't bring you back
  }
}

/** the invitation is answered: out of the window and the address bar */
export function dismissInvite(win: MpWindow): void {
  win.state.invite = null;
  try {
    history.replaceState(null, "", location.pathname + location.search);
  } catch {
    // the link stays in the address bar; harmless
  }
  win.render();
}

/** once the terms are accepted: show an invitation from the address bar, or rejoin this tab's room */
export function onStart(win: MpWindow): void {
  const { session, bus } = win.deps;
  bus.on("room:joined", () => setTabRoom(session.net.id));
  bus.on("room:left", () => setTabRoom(null));
  const invited = invitedCode(location.hash);
  if (invited) {
    win.state.invite = invited;
    win.state.tab = "rooms";
    showWindow("mp", true);
    win.render();
    return;
  }
  const again = tabRoom();
  if (again && session.networkAllowed() && !session.inRoom()) {
    void session.join(again);
    toast("Back in the room you were in before the page reloaded");
  }
}
