/**
 * One room at a time per browser: tabs of the same browser are the same person, and two of them in rooms would
 * be that person twice (two hosts, two owners). A tab in a room holds a Web Lock; another tab of this browser
 * doesn't get it, so it doesn't enter. The browser lets go of it when the tab closes. Without Web Locks (an old
 * browser) nothing is guarded.
 */
const LOCK = "makervale-in-room";

let release: (() => void) | null = null;
/** a request on its way: a second one (a double click) waits for it instead of competing with it */
let asking: Promise<boolean> | null = null;

/** take this browser's room slot for this tab; false if another tab has it */
export function holdRoom(): Promise<boolean> {
  if (release) return Promise.resolve(true);
  const locks = typeof navigator !== "undefined" ? navigator.locks : undefined;
  if (!locks) return Promise.resolve(true);
  asking ??= new Promise<boolean>((resolve) => {
    void locks.request(LOCK, { ifAvailable: true }, (lock) => {
      resolve(!!lock);
      if (!lock) return;
      return new Promise<void>((done) => (release = done));
    });
  }).finally(() => (asking = null));
  return asking;
}

export function releaseRoom(): void {
  release?.();
  release = null;
}
