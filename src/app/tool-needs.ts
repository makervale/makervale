import type { Mesh } from "@/lib/mesh/mesh";
import type { ElementSelection } from "@/lib/mesh/selection";
import { selectedEdges, selectedFaces, selectedVerts, selectionCount } from "@/lib/mesh/selection";
import type { Obj } from "@/world/model";
import type { Store } from "./store";
import type { Need } from "./tools";

interface Situation {
  objs: Obj[];
  target: Obj | null;
  sel: ElementSelection;
}

type Check = (s: Situation) => string | null;

/** a requirement on the mesh being edited: what to say when nothing is being edited, then the real check */
function whileEditing(hint: string, check: (mesh: Mesh, sel: ElementSelection) => string | null): Check {
  return ({ target, sel }) => (target ? check(target.mesh, sel) : hint);
}

function exactlyOneObject({ objs }: Situation): string | null {
  if (objs.length === 1) return null;
  return objs.length ? "Select only one object" : "Select an object";
}

const atLeastVerts = (n: number): Check =>
  whileEditing("Select vertices: Vertices mode (key 3)", (mesh, sel) =>
    selectedVerts(mesh, sel).size >= n ? null : `Select at least ${n} vertices`,
  );

const CHECKS: Record<Need, Check> = {
  none: () => null,
  objects: ({ objs }) => (objs.length ? null : "Select an object"),
  obj1: exactlyOneObject,
  mesh: exactlyOneObject,
  objects2: ({ objs }) => (objs.length >= 2 ? null : "Select at least two objects (Shift+click)"),
  elems: whileEditing("Enter mesh editing (keys 2–5) and select elements", (_, sel) =>
    selectionCount(sel) ? null : "Select vertices, edges or faces",
  ),
  faces: whileEditing("Select faces: switch to Faces mode (key 5)", (mesh, sel) =>
    selectedFaces(mesh, sel).size ? null : "Select at least one face",
  ),
  edges: whileEditing("Select edges: Edges mode (key 4)", (mesh, sel) =>
    selectedEdges(mesh, sel).size ? null : "Select at least one edge",
  ),
  edge1: whileEditing("Select an edge: Edges mode (key 4)", (_, sel) =>
    sel.edges.size ? null : "Select the edge the cut should go through",
  ),
  verts2: atLeastVerts(2),
  verts3: atLeastVerts(3),
  vert1: whileEditing("Select a vertex: Vertices mode (key 3)", (_, sel) =>
    sel.verts.size === 1 && !sel.edges.size && !sel.faces.size ? null : "Select exactly one vertex",
  ),
  facesOrEdges: whileEditing("Enter mesh editing (keys 4–5) and select faces or edges", (_, sel) =>
    sel.faces.size || sel.edges.size ? null : "Select faces or edges",
  ),
  twoParts: whileEditing(
    "Enter mesh editing (keys 4–5) and select a face on each part, or the edges of two holes",
    (_, sel) =>
      sel.faces.size >= 2 || sel.edges.size >= 2
        ? null
        : "Select one face on each of the two parts (Shift+click), or the edges of two holes",
  ),
};

/** why a tool can't run on the current selection, or null when it can */
export function needReason(store: Store, need: Need): string | null {
  return CHECKS[need]({ objs: store.selected(), target: store.editTarget(), sel: store.selection.elements });
}
