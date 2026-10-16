/** Clicks about rooms: start, join, open, remove; inside a room, the link, leaving, copying and the owner's tools. */
import { toast } from "@/ui/toast";
import { showWindow } from "@/ui/window";
import { canonicalCode, inviteLink } from "@/net";
import { dismissInvite } from "./invite";
import { checkOnce } from "./relay-actions";
import type { MpWindow } from "./state";

const input = (win: MpWindow, sel: string) => win.body.querySelector<HTMLInputElement>(sel);

export async function refreshMine(win: MpWindow): Promise<void> {
  win.state.mine = await win.deps.session.savedRooms();
  win.render();
}

function copy(text: string, done: string): void {
  navigator.clipboard?.writeText(text).then(
    () => toast(done),
    () => toast("Copy failed: " + text),
  );
}

function start(win: MpWindow): void {
  const name = input(win, "#mp-room-name")?.value.trim() || "Untitled room";
  const kind = input(win, "input[name=mp-kind]:checked")?.value === "public" ? "public" : "private";
  void win.deps.session.host(name, kind).then(() => checkOnce(win));
}

export function joinCode(win: MpWindow, text: string): void {
  const code = canonicalCode(text);
  if (!code) {
    toast("That isn't a room link or code");
    return;
  }
  void win.deps.session.join(code);
  toast("Your own scene waits aside and comes back when you leave.");
}

function leave(win: MpWindow): void {
  void win.deps.session.leave().then(() => {
    toast("You left. The room is under Your rooms; your own scene is back.");
    void refreshMine(win);
  });
}

function confirmDelete(win: MpWindow, id: string, name: string): void {
  toast(`Delete "${name}"? Your copy and the one kept online go. People who were in it keep their own copies.`, {
    label: "Delete",
    run: () => void win.deps.session.deleteRoom(id).then(() => refreshMine(win)),
  });
}

function inviteClick(win: MpWindow, t: HTMLElement): boolean {
  const yes = !!t.closest("#mp-invite-join");
  if (!yes && !t.closest("#mp-invite-no")) return false;
  const code = win.state.invite;
  dismissInvite(win);
  if (yes && code) joinCode(win, code);
  return true;
}

/** outside rooms; true if the click was one of these */
export function lobbyClick(win: MpWindow, t: HTMLElement): boolean {
  const s = win.deps.session;
  const pick = (attr: string) => t.closest<HTMLElement>(`[${attr}]`);
  const [reopen, forget, del, pub] = [
    pick("data-reopen"),
    pick("data-forget"),
    pick("data-delete"),
    pick("data-join-public"),
  ];
  if (t.closest("#mp-start")) start(win);
  else if (t.closest("#mp-join")) joinCode(win, input(win, "#mp-code")?.value ?? "");
  else if (inviteClick(win, t)) return true;
  else if (reopen) void s.reopen(reopen.dataset.reopen!);
  else if (forget) void s.forgetRoom(forget.dataset.forget!).then(() => refreshMine(win));
  else if (del) confirmDelete(win, del.dataset.delete!, del.dataset.name ?? "this room");
  else if (pub) {
    win.state.tab = "rooms";
    void s.join(pub.dataset.joinPublic!, "public", pub.dataset.name);
  } else if (t.closest("#mp-avatar")) showWindow("avwin", true);
  else return false;
  return true;
}

/** inside a room; true if the click was one of these */
export function inRoomClick(win: MpWindow, t: HTMLElement): boolean {
  const s = win.deps.session;
  if (t.closest("#mp-copy-link"))
    copy(inviteLink(s.net.id, location.href), "Invite link copied: send it to the people you want in");
  else if (t.closest("#mp-copy-code")) copy(s.net.id, "Room code copied");
  else if (t.closest("#mp-leave")) leave(win);
  else if (t.closest("#mp-copy-room"))
    void s.makeCopy().then(() => toast("You're in your own copy now. The original stays as it was."));
  else if (t.closest("#mp-ask")) {
    toast(s.askToBuild() ? "Asked the owner" : "You asked a moment ago");
    win.render();
  } else return false;
  return true;
}
