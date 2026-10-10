/** What the pie offers while building: tools that fit the selection, plus a few shortcuts. */
import { needReason } from "@/app/tool-needs";
import type { ElementSelection } from "@/lib/mesh/selection";
import { emptySelection } from "@/lib/mesh/selection";
import type { WorldHit } from "@/render/picking";
import type { ElementPick } from "@/render/preselect";
import type { Obj } from "@/world/model";
import type { PieDeps, PieItem } from "./deps";
import { placeItems, sitItems, touchItem } from "./common-items";

const ELEM_FACE = ["extrude", "inset", "bevel", "knife", "bridge", "newmat", "delfaces", "detach"];
const ELEM_EDGE = ["loopcut", "bevel", "knife", "loop", "ring", "dissolve", "bridge", "deledges"];
const ELEM_VERT = ["merge", "connect", "spike", "knife", "fill", "flatten", "smooth", "delverts"];
const ELEM_NONE = ["knife", "loopcut", "selall", "selsharp", "subdivide", "bisect", "solidify"];
const OBJ = ["duplicate", "boolean", "join", "group", "origin", "ground", "hide", "delete"];
const MAX_TOOLS = 7;

export interface Pie {
  title: string;
  items: PieItem[];
}

function has(s: ElementSelection, el: ElementPick): boolean {
  if (el.type === "v") return s.verts.has(el.id);
  if (el.type === "e") return s.edges.has(el.id);
  return s.faces.has(el.id);
}

function only(el: ElementPick): ElementSelection {
  const s = emptySelection();
  if (el.type === "v") s.verts.add(el.id);
  else if (el.type === "e") s.edges.add(el.id);
  else s.faces.add(el.id);
  return s;
}

/** a right-click selects what it is on first, like a left click would */
function selectUnderCursor(d: PieDeps, x: number, y: number, hit: WorldHit | null): void {
  const { store, commands } = d;
  if (store.editTarget()) {
    const el = d.renderer.pickElement(x, y);
    if (el && !has(store.selection.elements, el)) commands.setElements(only(el));
    return;
  }
  const o = hit?.id ? store.byId(hit.id) : undefined;
  if (o && !store.selection.objects.has(o.id)) commands.selectObject(o, false);
}

function toolSet(d: PieDeps): { ids: string[]; title: string } {
  const { store } = d;
  const s = store.selection.elements;
  if (store.editTarget()) {
    if (s.faces.size) return { ids: ELEM_FACE, title: "Faces" };
    if (s.edges.size) return { ids: ELEM_EDGE, title: "Edges" };
    if (s.verts.size) return { ids: ELEM_VERT, title: "Vertices" };
    return { ids: ELEM_NONE, title: "Mesh" };
  }
  const n = store.selection.objects.size;
  if (!n) return { ids: [], title: "Scene" };
  const first = store.byId([...store.selection.objects][0]);
  return { ids: OBJ, title: n === 1 ? (first?.name ?? "") : n + " objects" };
}

function toolItems(d: PieDeps, ids: string[]): PieItem[] {
  const use = (id: string) => () => d.bus.emit("tool:use", { id });
  return ids
    .map((id) => d.runner.tools.get(id))
    .filter((t) => t && !needReason(d.store, t.need))
    .slice(0, MAX_TOOLS)
    .map((t) => ({ label: t!.name, run: use(t!.id) }));
}

/** with nothing selected: make, go, look, select */
function sceneItems(d: PieDeps, hit: WorldHit | null): PieItem[] {
  const { store, runner } = d;
  const create = runner.tools.get(store.createType);
  const placeHere = () => {
    if (hit) runner.run(store.createType, undefined, { at: hit.point.toArray(), normal: hit.normal.toArray() });
  };
  return [
    { label: "Create here: " + (create?.name ?? store.createType), run: placeHere, disabled: !hit },
    ...placeItems(d, hit),
    { label: "Select all", run: () => d.bus.emit("tool:use", { id: "selall" }) },
    { label: "Show all", run: () => d.bus.emit("tool:use", { id: "unhide" }) },
  ];
}

function habits(d: PieDeps, items: PieItem[], hit: WorldHit | null, scripted: Obj | undefined): void {
  const editing = !!d.store.editTarget();
  if (scripted?.script)
    items.splice(1, 0, { label: "Edit script", run: () => d.bus.emit("script:open", { id: scripted.id }) });
  const touch = scripted && touchItem(d, scripted);
  if (touch) items.unshift(touch);
  if (editing) return;
  const [sit, stand] = sitItems(d, hit);
  if (sit) items.splice(1, 0, sit);
  if (stand) items.splice(1, 0, stand);
}

export function buildPie(d: PieDeps, x: number, y: number): Pie {
  const { store, commands } = d;
  const hit = d.renderer.picker.pickWorld(x, y);
  selectUnderCursor(d, x, y, hit);
  const editing = !!store.editTarget();
  const scripted = !editing && hit?.id ? store.byId(hit.id) : undefined;
  const { ids, title } = toolSet(d);
  const items = toolItems(d, ids);
  if (!editing && store.selection.objects.size === 1)
    items.unshift({ label: "Edit mesh", run: () => commands.setMode("auto") });
  habits(d, items, hit, scripted);
  if (editing) items.unshift({ label: "Done", run: () => commands.setMode("object") });
  if (!store.selection.objects.size) items.push(...sceneItems(d, hit));
  items.push({ label: "All tools…", run: () => d.bus.emit("menu:command", { command: "catalog" }) });
  return { title, items };
}
