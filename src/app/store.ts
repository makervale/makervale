import type { ElementSelection, EditMode } from "@/lib/mesh/selection";
import { emptySelection } from "@/lib/mesh/selection";
import type { Obj, World } from "@/world/model";
import { emptyWorld, findObj, groupOf } from "@/world/model";
import type { Settings } from "./settings";
import { defaultSettings } from "./settings";

export type Manipulator = "move" | "rotate" | "scale";
export type ToolMode = "edit" | "create";

export interface Selection {
  objects: Set<string>;
  /** the object selected last: the pivot for groups and the one tabs show */
  last: string | null;
  elements: ElementSelection;
  mode: EditMode;
}

export interface Modifiers {
  alt: boolean;
  ctrl: boolean;
  shift: boolean;
}

/**
 * All application state in one place. Only commands (app/commands.ts) write to it;
 * everything else reads and listens to the bus.
 */
export class Store {
  world: World = emptyWorld();
  selection: Selection = { objects: new Set(), last: null, elements: emptySelection(), mode: "object" };
  toolMode: ToolMode = "edit";
  manipulator: Manipulator = "move";
  createType = "box";
  createParams: Record<string, Record<string, number>> = {};
  settings: Settings = defaultSettings();
  modifiers: Modifiers = { alt: false, ctrl: false, shift: false };

  byId(id: string): Obj | undefined {
    return findObj(this.world, id);
  }

  selected(): Obj[] {
    return this.world.objects.filter((o) => this.selection.objects.has(o.id));
  }

  /** the object whose elements are being edited: one selected object in an element mode */
  editTarget(): Obj | null {
    const selected = this.selected();
    return this.selection.mode !== "object" && selected.length === 1 ? selected[0] : null;
  }

  groupOf(o: Obj): Obj[] {
    return groupOf(this.world, o);
  }

  visibleObjects(): Obj[] {
    return this.world.objects.filter((o) => !o.hidden);
  }
}
