import { afterEach, describe, expect, it } from "vitest";
import { holdRoom, releaseRoom } from "./tab-lease";

/** Web Locks as another tab sees them: `taken` stands for a lock some other tab holds */
function fakeLocks(taken: boolean) {
  const held = new Set<string>();
  Object.defineProperty(globalThis, "navigator", {
    configurable: true,
    value: {
      locks: {
        request: async (name: string, _o: unknown, cb: (lock: unknown) => Promise<void> | void) => {
          if (taken || held.has(name)) return cb(null);
          held.add(name);
          await cb({ name });
          held.delete(name);
        },
      },
    },
  });
}

afterEach(() => releaseRoom());

describe("one room at a time per browser", () => {
  it("a tab gets the slot when no other tab has it, and keeps it until it leaves", async () => {
    fakeLocks(false);
    expect(await holdRoom()).toBe(true);
    expect(await holdRoom()).toBe(true);
  });

  it("a second ask while the first is on its way (a double click) gets the same answer", async () => {
    fakeLocks(false);
    expect(await Promise.all([holdRoom(), holdRoom()])).toEqual([true, true]);
  });

  it("a tab doesn't get it while another tab is in a room", async () => {
    fakeLocks(true);
    expect(await holdRoom()).toBe(false);
  });
});
