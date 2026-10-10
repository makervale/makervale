/**
 * The switch that lets the app talk to the network at all. Nothing (relays, STUN, rooms) is contacted until the
 * person has read the risks in the Multiplayer window, confirmed they are an adult and said yes. The answer lasts
 * for this visit only (it is never stored), and "Withdraw consent" in the window takes it back at once, leaving
 * any room. Avatar downloads are the one thing outside this switch: wearing an
 * avatar from the index is an explicit choice, and the Avatar window says what it does.
 */
let allowed = false;
const waiting: (() => void)[] = [];

export const networkAllowed = (): boolean => allowed;

export function allowNetwork(): void {
  if (allowed) return;
  allowed = true;
  for (const fn of waiting.splice(0)) fn();
}

/** back to offline: nothing new is started until the person agrees again (the window leaves the room first) */
export function revokeNetwork(): void {
  allowed = false;
}

/** run `fn` now if the network is allowed, else as soon as it is */
export function whenOnline(fn: () => void): void {
  if (allowed) fn();
  else waiting.push(fn);
}
