/** What clicks, changes and keys in the Multiplayer window do. */
import { toast } from "@/ui/toast";
import { showWindow } from "@/ui/window";
import { galleryClick, loadGallery, viewBarClick } from "./gallery-clicks";
import { ownerClick } from "./owner-clicks";
import { relayClick } from "./relay-actions";
import { inRoomClick, joinCode, lobbyClick } from "./room-clicks";
import { KIND_TEXT } from "./rooms-view";
import type { MpTab, MpWindow } from "./state";

function openTab(win: MpWindow, tab: MpTab): void {
  win.state.tab = tab;
  win.render();
  if (tab === "gallery" && !win.state.gallery && !win.state.galleryBusy) void loadGallery(win);
}

async function withdraw(win: MpWindow): Promise<void> {
  const s = win.deps.session;
  if (s.inRoom()) await s.leave();
  s.revokeNetwork();
  toast("Consent withdrawn: you are offline. Multiplayer asks again before going online.");
  win.render();
}

/** going online (after the age check), staying offline, withdrawing consent; true if the click was one of these */
function consentClick(win: MpWindow, t: HTMLElement): boolean {
  if (t.closest("#mp-agree")) {
    if (!win.body.querySelector<HTMLInputElement>("#mp-adult")?.checked) {
      toast("Multiplayer is for adults: confirm that you are 18 or older first");
      return true;
    }
    win.deps.session.allowNetwork();
    win.render();
  } else if (t.closest("#mp-later")) showWindow("mp", false);
  else if (t.closest("#mp-withdraw")) void withdraw(win);
  else return false;
  return true;
}

function onClick(win: MpWindow, t: HTMLElement): void {
  const tab = t.closest<HTMLElement>("[data-tab]");
  if (tab) return openTab(win, tab.dataset.tab as MpTab);
  if (consentClick(win, t) || lobbyClick(win, t) || inRoomClick(win, t) || ownerClick(win, t)) return;
  if (!galleryClick(win, t)) relayClick(win, t);
}

function onChange(win: MpWindow, t: HTMLInputElement): void {
  const s = win.deps.session;
  if (t.id === "mp-everyone") void s.setEveryoneBuilds(t.checked);
  else if (t.id === "mp-keep") void s.keepOnline(t.checked);
  else if (t.name === "mp-kind") {
    const text = win.body.querySelector("#mp-kind-text");
    if (text) text.textContent = KIND_TEXT[t.value === "public" ? "public" : "private"];
  } else if (t.id === "mp-pub-target") {
    const note = win.body.querySelector<HTMLElement>("#mp-pub-note");
    const title = win.body.querySelector<HTMLElement>("#mp-pub-title");
    if (note) note.hidden = !t.value;
    if (title) title.hidden = !!t.value;
  }
}

export function wireActions(win: MpWindow): void {
  win.body.addEventListener("click", (e) => onClick(win, e.target as HTMLElement));
  win.body.addEventListener("change", (e) => onChange(win, e.target as HTMLInputElement));
  // "toggle" doesn't bubble: listen on the way down
  win.body.addEventListener(
    "toggle",
    (e) => {
      const d = e.target as HTMLDetailsElement;
      const id = d.dataset?.fold;
      if (!id) return;
      if (d.open) win.state.folds.add(id);
      else win.state.folds.delete(id);
    },
    true,
  );
  win.body.addEventListener("keydown", (e) => {
    const t = e.target as HTMLInputElement;
    if (e.key === "Enter" && t.id === "mp-code") {
      e.preventDefault();
      joinCode(win, t.value);
    }
    if (e.key === "Escape") {
      t.blur();
      document.getElementById("view")?.focus();
    }
  });
  document.addEventListener("click", (e) => {
    const b = (e.target as HTMLElement).closest<HTMLElement>("[data-viewbar]");
    if (b) viewBarClick(win, b.dataset.viewbar!);
  });
}
