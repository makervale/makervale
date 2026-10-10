/** Material tab edits: pick, add, assign, select by and delete materials; name, colour, pattern and the numbers. */
import { facesByMaterial } from "@/lib/mesh/select-grow";
import { facesSelection } from "@/lib/mesh/selection-of";
import { selectedFaces } from "@/lib/mesh/selection";
import type { Material, Obj } from "@/world/model";
import { defaultMaterial, ensureMaterialSlots } from "@/world/model";
import type { SpinPhase } from "@/ui/spinner";
import { onSpin } from "@/ui/spinner";
import type { Build, Clicks, Field } from "./context";

const NEW_COLORS = ["#b5643c", "#3f6d8f", "#6f8f5a", "#d9a441", "#8c7db3"];
type NumberKey = "repU" | "repV" | "rot" | "roughness" | "metalness" | "opacity" | "emissive";
/** shown as 0–100 % */
const PERCENT = new Set<NumberKey>(["roughness", "metalness", "opacity", "emissive"]);

const one = (b: Build): Obj | undefined => b.deps.store.selected()[0];

/** a change to one object's materials: one undo entry; missing slots are filled in first */
function change(b: Build, label: string, o: Obj, edit: (o: Obj) => void): void {
  b.deps.commands.act(label, [o.id], () => {
    ensureMaterialSlots(o);
    edit(o);
  });
}

function addMaterial(b: Build, o: Obj): void {
  change(b, "New material", o, () => {
    const n = o.materials.length;
    o.materials.push(defaultMaterial({ name: "Material " + (n + 1), color: NEW_COLORS[n % NEW_COLORS.length] }));
    b.matSlot = o.materials.length - 1;
  });
}

function assignMaterial(b: Build, o: Obj): void {
  const faces = selectedFaces(o.mesh, b.deps.store.selection.elements);
  change(b, "Assign material", o, () => faces.forEach((f) => (o.mesh.fm[f] = b.matSlot)));
}

function selectFaces(b: Build, o: Obj): void {
  const { commands } = b.deps;
  if (!commands.setMode("face")) return;
  commands.setElements(facesSelection(facesByMaterial(o.mesh, b.matSlot)));
}

function deleteMaterial(b: Build, o: Obj): void {
  const slot = b.matSlot;
  change(b, "Delete material", o, () => {
    o.materials.splice(slot, 1);
    o.mesh.fm = o.mesh.fm.map((s) => (s > slot ? s - 1 : s));
    b.matSlot = 0;
  });
}

const withObject =
  (run: (b: Build, o: Obj) => void) =>
  (b: Build): void => {
    const o = one(b);
    if (o) run(b, o);
  };

export const MATERIAL_CLICKS: Clicks = [
  [
    "[data-slot]",
    (b, el) => {
      b.matSlot = +el.dataset.slot!;
      b.renderTab();
    },
  ],
  ["#mt-new", withObject(addMaterial)],
  ["#mt-assign", withObject(assignMaterial)],
  ["#mt-select", withObject(selectFaces)],
  ["#mt-del", withObject(deleteMaterial)],
];

function setField(b: Build, o: Obj, edit: (m: Material) => void): () => void {
  return () => {
    ensureMaterialSlots(o);
    const m = o.materials[b.matSlot];
    if (m) edit(m);
  };
}

/** name and pattern apply on change; the colour previews while picking (`phase` "live") and applies on change */
export function onMaterialInput(b: Build, t: Field, phase: SpinPhase): boolean {
  const o = one(b);
  if (!o || !t.id.startsWith("mt-")) return false;
  if (t.id === "mt-name")
    change(
      b,
      "Material",
      o,
      setField(b, o, (m) => (m.name = t.value.trim() || m.name)),
    );
  else if (t.id === "mt-pattern")
    change(
      b,
      "Pattern",
      o,
      setField(b, o, (m) => (m.pattern = t.value)),
    );
  else if (t.id === "mt-color") {
    (t.parentElement as HTMLElement).style.background = t.value;
    b.drag.step({ label: "Color", objs: [o], phase, apply: setField(b, o, (m) => (m.color = t.value)) });
  } else return false;
  return true;
}

export function wireMaterialEdits(b: Build): void {
  onSpin("mat", (key, v, phase) => {
    const o = one(b);
    if (!o) return;
    const k = key.split(":")[1] as NumberKey;
    const value = PERCENT.has(k) ? v / 100 : v;
    b.drag.step({ label: "Material", objs: [o], phase, apply: setField(b, o, (m) => (m[k] = value)) });
  });
}
