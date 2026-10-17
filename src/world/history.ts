import type { Obj, World } from "./model";
import { cloneObj } from "./model";

/** a snapshot of the objects an action touched; null means the object did not exist */
type Snapshot = Map<string, Obj | null>;

export interface Entry {
  label: string;
  before: Snapshot;
  after: Snapshot;
  orderBefore: string[];
  orderAfter: string[];
  selectionBefore?: unknown;
  selectionAfter?: unknown;
  /** the tool that made this entry, so it can be re-run with other parameters */
  tool?: { id: string; params: Record<string, unknown> };
  /** made while a whole scene was taken as it is: undo and redo don't ask the laws either */
  asIs?: boolean;
}

interface OpenAction {
  label: string;
  before: Snapshot;
  existing: Set<string>;
  orderBefore: string[];
  selectionBefore: unknown;
}

export interface HistoryHooks {
  world: () => World;
  getSelection: () => unknown;
  setSelection: (s: unknown) => void;
  /** these objects just changed because of an action, undo or redo; `reverted`: they went back to how they were
   * (a cancel, or an action that may not stand), so nobody changed them */
  applied: (ids: string[], reverted?: boolean) => void;
  /** may an action (or an undo, a redo) that changed these objects stand? false takes it back at once (the laws of
   * space, app/space.ts) */
  permits?: (ids: string[]) => boolean;
  /** a whole scene is being taken as it is right now */
  asIs?: () => boolean;
}

const LIMIT = 200;

/**
 * Undo history that stores only the objects an action touched. An action is bracketed by begin() and end();
 * objects created or deleted in between are picked up automatically.
 */
export class History {
  readonly undoStack: Entry[] = [];
  readonly redoStack: Entry[] = [];
  private open: OpenAction | null = null;
  /** the entry taken back for a re-run; its objects are reported on the next end() even if nothing changed */
  private rerun: Entry | null = null;

  constructor(private readonly hooks: HistoryHooks) {}

  get isOpen(): boolean {
    return this.open !== null;
  }

  last(): Entry | undefined {
    return this.undoStack[this.undoStack.length - 1];
  }

  begin(label: string, ids: Iterable<string>): void {
    if (this.open) this.end();
    const world = this.hooks.world();
    const before: Snapshot = new Map();
    for (const id of ids) before.set(id, this.snapshotOf(world, id));
    this.open = {
      label,
      before,
      existing: new Set(world.objects.map((o) => o.id)),
      orderBefore: world.objects.map((o) => o.id),
      selectionBefore: this.hooks.getSelection(),
    };
  }

  /** include another object in the open action, before it changes */
  touch(id: string): void {
    if (!this.open || this.open.before.has(id)) return;
    this.open.before.set(id, this.snapshotOf(this.hooks.world(), id));
  }

  end(tool?: Entry["tool"]): Entry | null {
    const action = this.open;
    if (!action) return null;
    this.open = null;
    const world = this.hooks.world();
    this.noteCreatedObjects(action, world);
    const after: Snapshot = new Map();
    for (const id of action.before.keys()) after.set(id, this.snapshotOf(world, id));

    const changed = [...action.before].some(([id, b]) => !sameObject(b, after.get(id) ?? null));
    const rerun = this.rerun;
    this.flushPendingRerun(changed);
    if (!changed) return null;
    // a re-run changed what the run it replaced made, too (an object it created is gone now)
    const ids = [...new Set([...after.keys(), ...(rerun ? rerun.before.keys() : [])])];
    if (!this.permits(ids)) {
      this.restore(action.before, action.orderBefore);
      // a re-run that may not stand leaves the run it replaced as it was
      if (rerun) this.putBack(rerun);
      this.hooks.applied(ids, true);
      return null;
    }

    const entry: Entry = {
      label: action.label,
      before: action.before,
      after,
      orderBefore: action.orderBefore,
      orderAfter: world.objects.map((o) => o.id),
      selectionBefore: action.selectionBefore,
      selectionAfter: this.hooks.getSelection(),
      tool,
      asIs: this.hooks.asIs?.() || undefined,
    };
    this.push(entry);
    this.hooks.applied(ids);
    return entry;
  }

  cancel(): void {
    if (!this.open) return;
    const ids = [...this.open.before.keys(), ...(this.rerun ? this.rerun.before.keys() : [])];
    this.rerun = null;
    this.restore(this.open.before, this.open.orderBefore);
    this.open = null;
    this.hooks.applied(ids, true);
  }

  undo(): Entry | null {
    if (this.open) this.end();
    const entry = this.undoStack.pop();
    if (!entry) return null;
    if (!this.travel(entry, entry.before, entry.orderBefore)) {
      this.undoStack.push(entry);
      return null;
    }
    this.redoStack.push(entry);
    this.hooks.setSelection(entry.selectionBefore);
    this.hooks.applied([...entry.before.keys()]);
    return entry;
  }

  redo(): Entry | null {
    const entry = this.redoStack.pop();
    if (!entry) return null;
    if (!this.travel(entry, entry.after, entry.orderAfter)) {
      this.redoStack.push(entry);
      return null;
    }
    this.undoStack.push(entry);
    this.hooks.setSelection(entry.selectionAfter);
    this.hooks.applied([...entry.after.keys()]);
    return entry;
  }

  /** take the newest entry back so its tool can run again with other parameters */
  revertLastForRerun(): Entry | null {
    const entry = this.undoStack.pop();
    if (!entry) return null;
    this.restore(entry.before, entry.orderBefore);
    this.hooks.setSelection(entry.selectionBefore);
    this.rerun = entry;
    return entry;
  }

  clear(): void {
    this.open = null;
    this.undoStack.length = 0;
    this.redoStack.length = 0;
  }

  private snapshotOf(world: World, id: string): Obj | null {
    const o = world.objects.find((x) => x.id === id);
    return o ? cloneObj(o) : null;
  }

  private noteCreatedObjects(action: OpenAction, world: World): void {
    for (const o of world.objects) {
      if (!action.existing.has(o.id) && !action.before.has(o.id)) action.before.set(o.id, null);
    }
  }

  private flushPendingRerun(changed: boolean): void {
    if (!this.rerun) return;
    const ids = [...this.rerun.before.keys()];
    this.rerun = null;
    if (!changed) this.hooks.applied(ids, true);
  }

  /**
   * Take the scene to one side of an entry (undo, redo), if the laws let it. If not, the scene as it is now comes
   * back, not as it was when the entry was made: someone (a peer, a script) may have changed it since.
   */
  private travel(entry: Entry, to: Snapshot, order: string[]): boolean {
    const world = this.hooks.world();
    const now: Snapshot = new Map([...to.keys()].map((id) => [id, this.snapshotOf(world, id)]));
    const orderNow = world.objects.map((o) => o.id);
    this.restore(to, order);
    if (entry.asIs || this.permits(to.keys())) return true;
    this.restore(now, orderNow);
    return false;
  }

  private putBack(entry: Entry): void {
    this.restore(entry.after, entry.orderAfter);
    this.undoStack.push(entry);
  }

  private permits(ids: Iterable<string>): boolean {
    return !this.hooks.permits || this.hooks.permits([...ids]);
  }

  private push(entry: Entry): void {
    this.undoStack.push(entry);
    if (this.undoStack.length > LIMIT) this.undoStack.shift();
    this.redoStack.length = 0;
  }

  private restore(snapshot: Snapshot, order: string[]): void {
    const world = this.hooks.world();
    const byId = new Map(world.objects.map((o) => [o.id, o]));
    for (const [id, o] of snapshot) {
      if (o) byId.set(id, cloneObj(o));
      else byId.delete(id);
    }
    const ordered: Obj[] = [];
    for (const id of order) {
      const o = byId.get(id);
      if (o) {
        ordered.push(o);
        byId.delete(id);
      }
    }
    world.objects = [...ordered, ...byId.values()];
  }
}

const sameObject = (a: Obj | null, b: Obj | null): boolean => JSON.stringify(a) === JSON.stringify(b);
