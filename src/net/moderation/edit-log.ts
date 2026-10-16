/**
 * What the owner's browser remembers of this session, so the owner can undo damage: every change someone else made
 * (who, which object, before and after), and a copy of the whole scene every minute. Kept in memory on the owner's
 * computer only, for the last half hour; nothing of it is sent anywhere.
 */
import type { Obj, World } from "@/world/model";

export interface Change {
  at: number;
  who: string;
  id: string;
  before: Obj | null;
  after: Obj | null;
}

export interface Checkpoint {
  at: number;
  world: World;
}

export const KEEP_MS = 30 * 60_000;
export const CHECKPOINT_EVERY_MS = 60_000;
const MAX_CHANGES = 20_000;

export class EditLog {
  changes: Change[] = [];
  checkpoints: Checkpoint[] = [];

  record(change: Change): void {
    this.changes.push(change);
    if (this.changes.length > MAX_CHANGES) this.changes.splice(0, this.changes.length - MAX_CHANGES);
  }

  checkpoint(now: number, world: () => World): void {
    const last = this.checkpoints[this.checkpoints.length - 1];
    if (last && now - last.at < CHECKPOINT_EVERY_MS) return;
    this.checkpoints.push({ at: now, world: structuredClone(world()) });
    this.forget(now);
  }

  private forget(now: number): void {
    const old = now - KEEP_MS;
    while (this.checkpoints.length > 1 && this.checkpoints[1].at <= old) this.checkpoints.shift();
    while (this.changes.length && this.changes[0].at < old) this.changes.shift();
  }

  /** the newest copy taken at least this long ago (or the oldest there is) */
  checkpointBefore(at: number): Checkpoint | null {
    let found: Checkpoint | null = null;
    for (const c of this.checkpoints) if (c.at <= at) found = c;
    return found ?? this.checkpoints[0] ?? null;
  }

  peopleWithChanges(): Set<string> {
    return new Set(this.changes.map((c) => c.who));
  }
}

const same = (a: Obj | null | undefined, b: Obj | null | undefined): boolean =>
  JSON.stringify(a ?? null) === JSON.stringify(b ?? null);

/**
 * What "undo their changes" sets each object to (null: delete it). An object they created goes, even if someone
 * moved it since. An object they changed goes back to how it was before their changes, unless someone else changed
 * it after them: then that later change stands. `current` is the scene now.
 */
export function undoPlan(
  changes: Change[],
  who: string,
  current: (id: string) => Obj | undefined,
): Map<string, Obj | null> {
  const plan = new Map<string, Obj | null>();
  const byObject = new Map<string, Change[]>();
  for (const c of changes) {
    if (!byObject.has(c.id)) byObject.set(c.id, []);
    byObject.get(c.id)!.push(c);
  }
  for (const [id, list] of byObject) {
    const theirs = list.map((c, i) => (c.who === who ? i : -1)).filter((i) => i >= 0);
    if (!theirs.length) continue;
    if (list[0].who === who && list[0].before === null) {
      if (current(id)) plan.set(id, null);
      continue;
    }
    const last = theirs[theirs.length - 1];
    if (last !== list.length - 1 || !same(current(id), list[last].after)) continue;
    let first = last;
    while (first > 0 && list[first - 1].who === who) first--;
    plan.set(id, list[first].before);
  }
  return plan;
}
