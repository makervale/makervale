/** The one-line hint under the tools: what a click or drag does right now. */
import type { Store } from "@/app/store";
import { selectionCount } from "@/lib/mesh/selection";
import type { ManipulatorPort } from "./deps";

const PICK_HINT: Record<string, string> = {
  auto: "Click a vertex, edge or face; whatever you would grab is highlighted",
  vert: "Click a vertex or drag a box",
  edge: "Click an edge; double-click selects a loop",
  face: "Click a face; double-click selects the whole part",
};

/** Alt turns the mouse into the camera; Ctrl+Alt orbits, Ctrl+Alt+Shift pans */
function cameraHint(store: Store): string | null {
  const m = store.modifiers;
  if (!m.alt) return null;
  if (!m.ctrl) return "Camera: click a point; drag sideways to orbit, up/down to zoom";
  return m.shift ? "Pan: drag the view" : "Orbit: drag to circle the point";
}

function handleHint(store: Store, manip: ManipulatorPort): string {
  const editing = !!store.editTarget();
  const effective = manip.effManip();
  if (effective === "move" && manip.singlePoint()) {
    return "One point: drag an arrow or the point itself. Shift+drag pulls out a spike.";
  }
  if (effective === "move") {
    return editing
      ? "Drag an arrow or the element itself. E: extrude, /: search for a tool."
      : "Drag an arrow or the object. Shift+drag: copy. Double-click: edit the mesh.";
  }
  if (effective === "rotate") return "Drag a colored ring. Outside the ring: steps of 5.625°.";
  return "Colored face handle: one axis. Corner: proportional.";
}

export function statusText(store: Store, manip: ManipulatorPort, createName: string): string {
  const camera = cameraHint(store);
  if (camera) return camera;
  if (store.toolMode === "create") return "Click the ground or a face of an object to place: " + createName;
  if (!store.selection.objects.size)
    return "Click an object to select it. Double-click: edit the mesh. Right-click: menu.";
  if (store.editTarget() && !selectionCount(store.selection.elements)) return PICK_HINT[store.selection.mode] ?? "";
  return handleHint(store, manip);
}
