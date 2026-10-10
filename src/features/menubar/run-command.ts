/** Carry out a menu command. Most become a bus request; undo, selection and camera go straight to their owners. */
import { toast } from "@/ui/toast";
import { showWindow } from "@/ui/window";
import type { MenubarDeps } from "./deps";
import type { LocalCommand } from "./route";
import { route, SKY_NOTE } from "./route";
import type { Wireframe } from "./wireframe";

declare const __BUILD__: string;
/** the build stamp (build.mjs defines it), so it's obvious which version is running */
export const BUILD = typeof __BUILD__ === "string" ? __BUILD__ : "dev";

const FOCUS_K = 2.4;
const ABOUT =
  `Makervale (version ${BUILD}): build, script and hang out together in 3D, with no server. ` +
  "All tools are in the Tools panel on the right.";

/** Delete removes the selected elements while editing a mesh, else the selected objects */
function deleteToolId(d: MenubarDeps): string {
  if (!d.store.editTarget()) return "delete";
  const s = d.store.selection.elements;
  if (s.faces.size) return "delfaces";
  return s.edges.size ? "deledges" : "delverts";
}

function local(d: MenubarDeps, wire: Wireframe): Record<LocalCommand, () => void> {
  const { store, commands, bus, renderer } = d;
  return {
    undo: () => commands.undo(),
    redo: () => commands.redo(),
    del: () => bus.emit("tool:use", { id: deleteToolId(d) }),
    desel: () => commands.clearSelection(),
    focussel: () => {
      const s = store.selected();
      if (s.length) renderer.framing.frame(s, undefined, FOCUS_K);
    },
    home: () => renderer.framing.home(store.visibleObjects()),
    search: () => bus.emit("search:open", {}),
    wire: () => toast(wire.toggle() ? "Mesh edges: shown" : "Mesh edges: hidden"),
    about: () => toast(ABOUT),
  };
}

export function commandRunner(d: MenubarDeps, wire: Wireframe): (command: string) => void {
  const actions = local(d, wire);
  return (command) => {
    const r = route(command);
    if (r.kind === "tool") d.bus.emit("tool:use", { id: r.id });
    else if (r.kind === "window") showWindow(r.id, true);
    else if (r.kind === "feature") d.bus.emit("menu:command", { command: r.command });
    else if (r.kind === "local") actions[r.name]();
    else if (r.kind === "sky") {
      d.bus.emit("sky:set", { mode: r.mode });
      toast(SKY_NOTE[r.mode]);
    }
  };
}
