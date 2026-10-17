import type { EditMode, ElementSelection } from "@/lib/mesh/selection";
import { convertSelection, emptySelection } from "@/lib/mesh/selection";
import type { Mesh } from "@/lib/mesh/mesh";
import type { Entry } from "@/world/history";
import { History } from "@/world/history";
import type { Obj, World } from "@/world/model";
import type { Bus } from "./bus";
import type { SelectionSnapshot } from "./selection-snapshot";
import { restoreSelection, snapshotSelection } from "./selection-snapshot";
import type { Settings } from "./settings";
import { Space } from "./space";
import type { Store } from "./store";

/** who is making a change: only the user's changes enter the undo history */
export type Origin = "user" | "remote" | "script";

export interface Notice {
  (text: string): void;
}

/**
 * The only way state changes. A command touches the store, records history when the user did it,
 * and tells everyone through the bus. Remote peers and scripts use the same path, without history.
 */
export class Commands {
  readonly history: History;
  /** the objects of the held action in progress */
  private held: string[] = [];
  /** how many times each mesh changed; the renderer rebuilds geometry when this moves */
  private readonly meshRevisions = new WeakMap<Mesh, number>();
  /** the laws of space; a whole new scene is taken as it is (see replaceWorld) */
  readonly space: Space;

  constructor(
    private readonly store: Store,
    private readonly bus: Bus,
    public notice: Notice = () => {},
  ) {
    this.history = new History({
      world: () => store.world,
      getSelection: () => snapshotSelection(store),
      setSelection: (s) => {
        if (!s) return;
        restoreSelection(store, s as SelectionSnapshot);
        this.selectionChanged();
      },
      applied: (ids, reverted) => this.changed(ids, reverted),
      permits: (ids) => this.space.permits(ids, (text) => this.bus.emit("space:refused", { text })),
      asIs: () => this.space.takingAsIs,
    });
    this.space = new Space(store);
  }

  /* ---------- objects ---------- */

  /** a user action on some objects: one undo entry, one change event */
  act(label: string, ids: Iterable<string>, change: () => void, tool?: Entry["tool"]): Entry | null {
    const touched = [...ids];
    this.history.begin(label, touched);
    try {
      change();
      this.restartScripts(touched);
    } catch (error) {
      this.history.cancel();
      this.notice(error instanceof Error ? error.message : "The operation failed");
      return null;
    }
    const entry = this.history.end(tool);
    this.bus.emit("history:changed", { entry });
    return entry;
  }

  /** which of Alt / Ctrl / Shift are held; only a change is announced */
  setModifiers(m: Store["modifiers"]): void {
    const now = this.store.modifiers;
    if (now.alt === m.alt && now.ctrl === m.ctrl && now.shift === m.shift) return;
    this.store.modifiers = { ...m };
    this.bus.emit("modifiers:changed");
  }

  /* held actions (a drag, the knife): one undo entry stays open until the drop */

  /** start a held action; one already open (a pull that turned into a drag) just carries on */
  startHeld(label: string, ids: Iterable<string>): void {
    if (this.history.isOpen) return;
    this.held = [...ids];
    this.history.begin(label, this.held);
  }

  /** the held action is done: everything it did becomes one undo entry */
  finishHeld(): Entry | null {
    if (!this.history.isOpen) return null;
    this.restartScripts(this.held);
    const entry = this.history.end();
    this.bus.emit("history:changed", { entry });
    return entry;
  }

  /** Esc: everything the held action did goes back */
  cancelHeld(): void {
    if (this.history.isOpen) this.history.cancel();
  }

  /**
   * The user changed these objects by hand: their scripts start over from here. Otherwise a save (which keeps
   * scripted objects as they were when the script started, see world/resting.ts) would undo the user's change.
   */
  private restartScripts(ids: string[]): void {
    for (const id of ids) {
      const o = this.store.byId(id);
      if (o?.scriptState) delete o.scriptState;
    }
  }

  /** a change from a peer or a script: no history, everyone still updates */
  apply(ids: Iterable<string>, change: () => void): void {
    change();
    this.changed([...ids]);
  }

  /** an object is being dragged: the view follows, history waits for the drop */
  dragging(ids: string[]): void {
    this.bus.emit("world:dragging", { ids });
  }

  /** the mesh of this object changed in place */
  meshChanged(o: Obj): void {
    this.meshRevisions.set(o.mesh, this.revisionOf(o.mesh) + 1);
  }

  revisionOf(mesh: Mesh): number {
    return this.meshRevisions.get(mesh) ?? 0;
  }

  undo(): void {
    const entry = this.history.undo();
    this.bus.emit("history:changed", { entry });
  }

  redo(): void {
    const entry = this.history.redo();
    this.bus.emit("history:changed", { entry });
  }

  /** a whole new scene (file opened, room joined, sample loaded); the old one can be undone back */
  replaceWorld(world: World, label: string, undoable = true): void {
    const ids = new Set([...this.store.world.objects, ...world.objects].map((o) => o.id));
    const swap = () => {
      this.store.world.objects = world.objects;
      this.store.world.seq = Math.max(this.store.world.seq, world.seq);
    };
    if (undoable) this.space.takeAsIs(() => this.act(label, ids, swap));
    else {
      this.history.clear();
      this.apply(ids, swap);
    }
    this.clearSelection();
  }

  /* ---------- selection ---------- */

  selectObject(o: Obj, additive: boolean): void {
    const sel = this.store.selection;
    const group = this.store.settings.selectGroupPartsSeparately ? [o] : this.store.groupOf(o);
    if (!additive) sel.objects.clear();
    const allSelected = group.every((p) => sel.objects.has(p.id));
    if (additive && allSelected) group.forEach((p) => sel.objects.delete(p.id));
    else {
      group.forEach((p) => sel.objects.add(p.id));
      sel.last = o.id;
    }
    sel.elements = emptySelection();
    if (sel.objects.size !== 1) sel.mode = "object";
    this.selectionChanged();
  }

  selectObjects(ids: string[]): void {
    const sel = this.store.selection;
    sel.objects = new Set(ids);
    sel.last = ids[ids.length - 1] ?? null;
    sel.elements = emptySelection();
    if (ids.length !== 1) sel.mode = "object";
    this.selectionChanged();
  }

  clearSelection(): void {
    const sel = this.store.selection;
    sel.objects.clear();
    sel.elements = emptySelection();
    sel.mode = "object";
    this.selectionChanged();
  }

  setElements(elements: ElementSelection): void {
    this.store.selection.elements = elements;
    this.bus.emit("selection:changed");
  }

  setMode(mode: EditMode): boolean {
    const sel = this.store.selection;
    const target = this.store.selected();
    if (mode !== "object" && !this.canEditMesh(target)) return false;
    const stayingInElements = mode !== "object" && sel.mode !== "object";
    sel.elements = stayingInElements ? convertSelection(target[0].mesh, sel.elements, mode) : emptySelection();
    sel.mode = mode;
    this.selectionChanged();
    return true;
  }

  private canEditMesh(target: Obj[]): boolean {
    if (target.length !== 1) {
      this.notice(target.length ? "Mesh editing works on one object at a time" : "Select an object first");
      return false;
    }
    if (target[0].locked) {
      this.notice("The object is locked (Scene panel)");
      return false;
    }
    return true;
  }

  /* ---------- settings and modes ---------- */

  setSettings(changes: Partial<Settings>): void {
    Object.assign(this.store.settings, changes);
    this.bus.emit("settings:changed");
  }

  setToolMode(mode: Store["toolMode"], manipulator?: Store["manipulator"]): void {
    this.store.toolMode = mode;
    if (manipulator) this.store.manipulator = manipulator;
    this.bus.emit("mode:changed");
  }

  setCreateType(type: string): void {
    this.store.createType = type;
    this.bus.emit("mode:changed");
  }

  /* ---------- internals ---------- */

  private changed(ids: string[], reverted = false): void {
    this.space.follow(ids);
    for (const id of ids) {
      const o = this.store.byId(id);
      if (o) this.meshChanged(o);
    }
    this.bus.emit("world:changed", reverted ? { ids, reverted } : { ids });
  }

  private selectionChanged(): void {
    this.bus.emit("selection:changed");
    this.bus.emit("mode:changed");
  }
}
