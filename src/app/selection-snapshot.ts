/** The selection as history keeps it: an undo also brings back what was selected. */
import type { EditMode, ElementSelection } from "@/lib/mesh/selection";
import { cloneSelection } from "@/lib/mesh/selection";
import type { Store } from "./store";

export interface SelectionSnapshot {
  objects: string[];
  last: string | null;
  elements: ElementSelection;
  mode: EditMode;
}

export function snapshotSelection(store: Store): SelectionSnapshot {
  const s = store.selection;
  return { objects: [...s.objects], last: s.last, elements: cloneSelection(s.elements), mode: s.mode };
}

/** objects deleted since the snapshot are left out */
export function restoreSelection(store: Store, s: SelectionSnapshot): void {
  const sel = store.selection;
  sel.objects = new Set(s.objects.filter((id) => store.byId(id)));
  sel.last = s.last;
  sel.elements = cloneSelection(s.elements);
  sel.mode = s.mode;
}
