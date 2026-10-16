/**
 * The switch that lets the app talk to the network at all. Nothing (relays, STUN, rooms) is contacted until the
 * person has read the risks in the Multiplayer window, confirmed they are an adult and said yes. The answer is
 * remembered in this browser, tied to the version of the privacy note it was given for: a changed note asks again.
 * It is only acted on once that version of the terms was accepted on the start screen (boot calls restoreConsent
 * then). "Withdraw consent" in the window takes it back at once, leaving any room, and forgets it. Avatar downloads
 * are the one thing outside this switch: wearing an avatar from the index is an explicit choice, and the Avatar
 * window says what it does.
 */
import { TERMS_VERSION } from "@/app/privacy";

const KEY = "pias.online";

let allowed = false;
const waiting: (() => void)[] = [];

export const networkAllowed = (): boolean => allowed;

function remembered(): boolean {
  try {
    return localStorage.getItem(KEY) === TERMS_VERSION;
  } catch {
    return false;
  }
}

function remember(on: boolean): void {
  try {
    if (on) localStorage.setItem(KEY, TERMS_VERSION);
    else localStorage.removeItem(KEY);
  } catch {
    // without storage the answer lasts for this visit only
  }
}

function goOnline(): void {
  if (allowed) return;
  allowed = true;
  for (const fn of waiting.splice(0)) fn();
}

/** the person said yes in the Multiplayer window: online now, and next time */
export function allowNetwork(): void {
  remember(true);
  goOnline();
}

/** the terms were accepted: if consent was given before (for this version of the note), go online */
export function restoreConsent(): boolean {
  if (remembered()) goOnline();
  return allowed;
}

/** back to offline, and forgotten: nothing new is started until the person agrees again (the window leaves first) */
export function revokeNetwork(): void {
  allowed = false;
  remember(false);
}

/** run `fn` now if the network is allowed, else as soon as it is */
export function whenOnline(fn: () => void): void {
  if (allowed) fn();
  else waiting.push(fn);
}
