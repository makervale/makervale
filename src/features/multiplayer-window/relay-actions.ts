/** Your own TURN relay (save, remove) and the connection test. */
import { toast } from "@/ui/toast";
import type { MpWindow } from "./state";

function saveRelay(win: MpWindow): void {
  const ice = win.deps.session;
  const value = (id: string) => win.body.querySelector<HTMLInputElement>(id)!.value.trim();
  const urls = value("#mp-turn-urls");
  const custom = urls
    ? ice.validTurn({ urls, username: value("#mp-turn-user"), credential: value("#mp-turn-pass") })
    : null;
  if (urls && !custom) {
    toast("The address should look like turn:example.com:3478");
    return;
  }
  ice.setTurnPrefs({ ...ice.turnPrefs(), custom });
  // the last test was made with the old relay
  win.state.report = null;
  toast(custom ? "Saved. Test your connection to check it." : "Your own TURN server removed");
  win.render();
}

function clearRelay(win: MpWindow): void {
  const ice = win.deps.session;
  ice.setTurnPrefs({ ...ice.turnPrefs(), custom: null });
  win.state.report = null;
  toast("Your own TURN server removed");
  win.render();
}

export function runCheck(win: MpWindow): void {
  win.state.checking = true;
  win.render();
  const progress = win.deps.session.checkConnection((report) => {
    win.state.report = report;
    win.render();
  });
  void progress.finally(() => {
    win.state.checking = false;
    win.render();
  });
}

/** after opening a room: a test, once, so the host learns whether people will be able to join */
export function checkOnce(win: MpWindow): void {
  if (!win.state.report && !win.state.checking) runCheck(win);
}

export function relayClick(win: MpWindow, t: HTMLElement): void {
  if (t.closest("#mp-turn-clear")) clearRelay(win);
  else if (t.closest("#mp-turn-save")) saveRelay(win);
  else if (t.closest("#mp-check")) runCheck(win);
}
