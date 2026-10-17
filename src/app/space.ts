/**
 * The laws of space applied to the scene (lib/weight): a ledger that follows every change, and the question every
 * change answers before it stands. A person's action that would break a law is undone at once, with a word why;
 * the room's authority checks what peers send the same way (net/sync/objects.ts). A whole new scene you open in your own scene,
 * or the scene of a room you enter, is taken as it is, even over the laws: there you can then only remove and
 * simplify. Inside a room nobody, its owner included, brings in a scene over them.
 */
import type { Verdict } from "@/lib/weight";
import { Ledger, ROOM_CEILING } from "@/lib/weight";
import type { Vec3 } from "@/lib/vec";
import type { Obj } from "@/world/model";
import type { Store } from "./store";

export const VERDICT_TEXT = {
  dense: "Too dense here: this won't fit. Spread things out, or simplify what's around.",
  full: "This scene is full: remove or simplify something to make space.",
};

export class Space {
  readonly ledger = new Ledger();
  private asIs = false;
  /** may a whole new scene be taken as it is here? Not in a room (net/session.ts says so): there the law holds */
  mayTakeAsIs: () => boolean = () => true;

  constructor(private readonly store: Store) {
    this.ledger.reset(store.world.objects.map((o) => [o.id, o]));
  }

  private current(ids: Iterable<string>): [string, Obj | null][] {
    return [...ids].map((id) => [id, this.store.byId(id) ?? null]);
  }

  /** would the scene as it is now, for these objects, stand? (they changed, the ledger doesn't know yet) */
  check(ids: Iterable<string>): Verdict {
    return this.ledger.verdict(this.ledger.propose(this.current(ids)));
  }

  /** would these objects from elsewhere (and these deletions) stand, if applied? */
  checkIncoming(set: Obj[], del: string[]): Verdict {
    const changes: [string, Obj | null][] = [
      ...set.map((o): [string, Obj] => [o.id, o]),
      ...del.map((id): [string, null] => [id, null]),
    ];
    return this.ledger.verdict(this.ledger.propose(changes));
  }

  /** may a person's action that changed these objects stand? if not, `notice` says why */
  permits(ids: string[], notice: (text: string) => void): boolean {
    if (this.asIs) return true;
    const v = this.check(ids);
    if (!v.ok) notice(VERDICT_TEXT[v.why]);
    return v.ok;
  }

  get takingAsIs(): boolean {
    return this.asIs;
  }

  /** a whole new scene is taken as it is, over the laws or not (where that is allowed: see mayTakeAsIs) */
  takeAsIs(fn: () => void): void {
    this.asIs = this.mayTakeAsIs();
    try {
      fn();
    } finally {
      this.asIs = false;
    }
  }

  /** how much of the room's ceiling the scene takes, % */
  fill(): number {
    return Math.min(100, Math.ceil((this.ledger.total * 100) / ROOM_CEILING));
  }

  /**
   * May this body roll here? Only asked of the ledger when it would cross onto other cells; if it may, the ledger
   * follows it at once. A place too full is like a wall to it.
   */
  moveTo(o: Obj, pos: Vec3): boolean {
    const next = { ...o, pos };
    if (this.ledger.sameCells(o.id, next)) return true;
    const p = this.ledger.propose([[o.id, next]]);
    if (!this.ledger.verdict(p).ok) return false;
    this.ledger.commit(p);
    return true;
  }

  /** these objects changed and stand: the ledger follows */
  follow(ids: Iterable<string>): void {
    this.ledger.commit(this.ledger.propose(this.current(ids)));
  }
}
