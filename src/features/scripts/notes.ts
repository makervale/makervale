/**
 * What a running script has just run into, for its author: it rested (spent its gas for this second) or a move of
 * its didn't fit the space. Not errors: the script goes on. A note fades a moment after the last time it happened.
 */
import type { Bus } from "@/app/bus";

const SHOWN_S = 2;

const TEXT = {
  rest: "Resting: it did too much this second (steps or moves), so it waits for the next one. Slow it down with wait.",
  blocked: "Blocked: a move didn't fit, the space there is too full. It stays put; `on blocked` can react.",
};

export type NoteKind = keyof typeof TEXT;

export class ScriptNotes {
  private last = new Map<string, { kind: NoteKind; at: number }>();

  constructor(private readonly bus: Bus) {}

  add(id: string, kind: NoteKind, at: number): void {
    const was = this.last.get(id);
    // notes that have faded go, so scripts long stopped or removed leave nothing behind
    for (const [k, n] of this.last) if (at - n.at > SHOWN_S) this.last.delete(k);
    this.last.set(id, { kind, at });
    if (!was || was.kind !== kind || at - was.at > SHOWN_S) this.bus.emit("scripts:errors");
  }

  text(id: string, now: number): string | null {
    const n = this.last.get(id);
    return n && now - n.at <= SHOWN_S ? TEXT[n.kind] : null;
  }
}
