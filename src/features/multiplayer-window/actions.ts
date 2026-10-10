/** What clicks, changes and keys in the Multiplayer window do. */
import { toast } from "@/ui/toast";
import { showWindow } from "@/ui/window";
import { isRoomCode } from "./format";
import { refreshMine, stopBrowsing } from "./lists";
import { checkOnce, relayClick } from "./relay-actions";
import type { MpWindow } from "./state";

export function wireActions(win: MpWindow): void {
  win.body.addEventListener("click", (e) => {
    const t = e.target as HTMLElement;
    if (!consentClick(win, t) && !roomClick(win, t) && !savedRoomClick(win, t)) relayClick(win, t);
  });
  win.body.addEventListener("change", (e) => {
    const t = e.target as HTMLInputElement;
    if (t.id === "mp-list") win.deps.session.setPublic(t.checked);
    if (t.id === "mp-build-all") void win.deps.session.setBuildRule(t.checked);
  });
  win.body.addEventListener("keydown", (e) => {
    const t = e.target as HTMLInputElement;
    if (e.key === "Enter" && t.id === "mp-code") {
      e.preventDefault();
      join(win);
    }
    if (e.key === "Escape") {
      t.blur();
      document.getElementById("view")?.focus();
    }
  });
}

const input = (win: MpWindow, selector: string) => win.body.querySelector<HTMLInputElement>(selector)!;

function join(win: MpWindow, id?: string, name?: string): void {
  const code = (id || input(win, "#mp-code").value).trim();
  if (!isRoomCode(code)) {
    toast("That does not look like a room code");
    return;
  }
  void win.deps.session.join(code, name);
  toast("Your own scene is kept aside and comes back when you leave.");
}

function leave(win: MpWindow): void {
  void win.deps.session.leave().then(() => {
    toast("You left the room. It’s saved under My rooms; your own scene is back.");
    void refreshMine(win);
  });
}

/** consent withdrawn: out of the room first (the others are told), then offline, then the question again */
async function withdraw(win: MpWindow): Promise<void> {
  const { session, lobby } = win.deps;
  if (session.inRoom()) await session.leave();
  stopBrowsing(win);
  lobby.revokeNetwork();
  toast("Consent withdrawn: you are offline. Multiplayer asks again before going online.");
  win.render();
}

function copyCode(code: string): void {
  const copied = navigator.clipboard?.writeText(code);
  copied?.then(
    () => toast("Room code copied"),
    () => toast("Copy failed: the code is " + code),
  );
}

/** going online (after the age check), staying offline, withdrawing consent; true if the click was one of these */
function consentClick(win: MpWindow, t: HTMLElement): boolean {
  if (t.closest("#mp-agree")) {
    if (!input(win, "#mp-adult").checked) {
      toast("Multiplayer is for adults: confirm that you are 18 or older first");
      return true;
    }
    win.deps.lobby.allowNetwork();
    win.render();
  } else if (t.closest("#mp-later")) showWindow("mp", false);
  else if (t.closest("#mp-withdraw")) void withdraw(win);
  else return false;
  return true;
}

/** open, join, leave, copy the code, remove someone; true if the click was one of these */
function roomClick(win: MpWindow, t: HTMLElement): boolean {
  const { session } = win.deps;
  const listed = t.closest<HTMLElement>("[data-join]");
  const kick = t.closest<HTMLElement>("[data-kick]");
  if (t.closest("#mp-host")) {
    const name = input(win, "#mp-room").value.trim() || "Untitled room";
    session.host(name, input(win, "#mp-public").checked);
    checkOnce(win);
  } else if (t.closest("#mp-join")) join(win);
  else if (listed) join(win, listed.dataset.join, listed.dataset.name);
  else if (t.closest("#mp-leave")) leave(win);
  else if (t.closest("#mp-avatar")) showWindow("avwin", true);
  else if (t.closest("#mp-copy")) copyCode(session.net.id);
  else if (kick) {
    const id = kick.dataset.kick!;
    toast(`Remove ${kick.dataset.name} from this room? They can't come back this session.`, {
      label: "Remove",
      run: () => void session.kick(id),
    });
  } else return false;
  return true;
}

/** reopen or forget a room saved in this browser */
function savedRoomClick(win: MpWindow, t: HTMLElement): boolean {
  const reopen = t.closest<HTMLElement>("[data-reopen]");
  const forget = t.closest<HTMLElement>("[data-forget]");
  if (reopen) void win.deps.session.reopen(reopen.dataset.reopen!);
  else if (forget) {
    void win.deps.session.forgetRoom(forget.dataset.forget!).then(() => refreshMine(win));
    toast("Your copy of that room is deleted", { label: "OK", run: () => {} });
  } else return false;
  return true;
}
