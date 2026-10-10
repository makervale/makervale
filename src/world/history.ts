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
  /** these objects just changed because of an action, undo, redo or cancel */
  applied: (ids: string[]) => void;
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
  /** objects reverted for a re-run; reported on the next end() even if nothing changed */
  private pendingRerun: string[] | null = null;

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
    this.flushPendingRerun(changed);
    if (!changed) return null;

    const entry: Entry = {
      label: action.label,
      before: action.before,
      after,
      orderBefore: action.orderBefore,
      orderAfter: world.objects.map((o) => o.id),
      selectionBefore: action.selectionBefore,
      selectionAfter: this.hooks.getSelection(),
      tool,
    };
    this.push(entry);
    this.hooks.applied([...after.keys()]);
    return entry;
  }

  cancel(): void {
    if (!this.open) return;
    const ids = [...this.open.before.keys(), ...(this.pendingRerun ?? [])];
    this.pendingRerun = null;
    this.restore(this.open.before, this.open.orderBefore);
    this.open = null;
    this.hooks.applied(ids);
  }

  undo(): Entry | null {
    if (this.open) this.end();
    const entry = this.undoStack.pop();
    if (!entry) return null;
    this.restore(entry.before, entry.orderBefore);
    this.redoStack.push(entry);
    this.hooks.setSelection(entry.selectionBefore);
    this.hooks.applied([...entry.before.keys()]);
    return entry;
  }

  redo(): Entry | null {
    const entry = this.redoStack.pop();
    if (!entry) return null;
    this.restore(entry.after, entry.orderAfter);
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
    this.pendingRerun = [...entry.before.keys()];
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
    if (!this.pendingRerun) return;
    const ids = this.pendingRerun;
    this.pendingRerun = null;
    if (!changed) this.hooks.applied(ids);
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
