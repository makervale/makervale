/** Under the tools: the shapes to create, or what clicks select (Object, Mesh, Verts, Edges, Faces) and options. */
import type { Settings } from "@/app/settings";
import type { EditMode } from "@/lib/mesh/selection";
import { $, checkbox, esc } from "@/ui/dom";
import { onSpin, spinner } from "@/ui/spinner";
import type { Build, Clicks, Field } from "./context";

const CREATE_IDS = ["box", "plane", "cylinder", "cone", "sphere", "icosphere", "torus", "tube", "stairs"];
const SHAPE_PX = 64;
const GRID_METRES = [0.0625, 0.125, 0.25, 0.5, 1, 2, 4];

function createBlock(b: Build): string {
  const { store, runner, thumbnail } = b.deps;
  const shapes = CREATE_IDS.map((id) => {
    const t = runner.tools.get(id);
    if (!t) return "";
    const pressed = store.createType === id;
    return `<button data-shape="${id}" title="${esc(t.name)}: ${esc(t.summary)}" aria-pressed="${pressed}"><img alt="${esc(t.name)}" src="${thumbnail(t, SHAPE_PX)}"></button>`;
  }).join("");
  const sticky = checkbox(
    "o-sticky",
    "Stay in Create",
    store.settings.stayInCreate,
    "Do not go back to editing after placing a shape",
  );
  const name = esc(runner.tools.get(store.createType)?.name ?? "");
  return `<div class="shapes">${shapes}</div>
      <div class="r">${sticky}<span class="note" style="margin-left:auto">${name}</span></div>`;
}

function segments(b: Build): string {
  const { store } = b.deps;
  const one = store.selection.objects.size === 1;
  const seg = (m: EditMode, label: string, key: string) => {
    const off = m !== "object" && !one ? 'disabled title="Select one object"' : "";
    return `<button data-mode="${m}" aria-pressed="${store.selection.mode === m}" ${off}>${label}<small>${key}</small></button>`;
  };
  const all = seg("object", "Object", "1") + seg("auto", "Mesh", "2") + seg("vert", "Verts", "3");
  return `<div class="seg" role="group" aria-label="What to select">${all}${seg("edge", "Edges", "4")}${seg("face", "Faces", "5")}</div>`;
}

function handlesRow(s: Settings, objectMode: boolean): string {
  const opt = (v: string, label: string, extra = "") =>
    `<option value="${v}" ${s.axes === v ? "selected" : ""} ${extra}>${label}</option>`;
  const axes = opt("world", "World") + opt("local", "Local") + opt("normal", "Normal", objectMode ? "disabled" : "");
  const grid = GRID_METRES.map((g) => `<option value="${g}" ${g === s.gridMetres ? "selected" : ""}>${g} m</option>`);
  const snapTip = "Slide the cursor off the arrow onto the ruler to make the move jump between ticks (G)";
  return (
    `<div class="r">${checkbox("o-snap", "Snap", s.snap, snapTip)}<span class="lbl">Axes:</span>` +
    `<select class="cb" id="o-axes">${axes}</select><select class="cb" id="o-grid" title="Ruler ticks">${grid.join("")}</select>` +
    `${checkbox("o-both", "Both sides", s.stretchBothSides, "Stretch both ways from the center")}</div>`
  );
}

function selectionRow(s: Settings, objectMode: boolean): string {
  if (objectMode)
    return `<div class="r">${checkbox("o-parts", "Select group parts separately", s.selectGroupPartsSeparately)}</div>`;
  const soft = spinner("soft", "", s.softRadiusMetres, {
    min: 0,
    max: 20,
    step: 0.05,
    decimals: 2,
    aria: "Soft selection radius in metres",
  });
  return (
    `<div class="r">${checkbox("o-mirror", "X mirror", s.mirrorX, "Moves are mirrored on the other side of the X axis")}` +
    `${checkbox("o-xray", "X-ray", s.xray, "Box select also grabs what you cannot see (back, inside)")}` +
    `<span class="lbl">Soft:</span><div style="width:84px">${soft}</div><span class="lbl">m</span></div>`
  );
}

export function renderMode(b: Build): void {
  const { store } = b.deps;
  const el = $("#b-mode", b.root);
  if (store.toolMode === "create") {
    el.innerHTML = createBlock(b);
    return;
  }
  const objectMode = store.selection.mode === "object";
  el.innerHTML = segments(b) + handlesRow(store.settings, objectMode) + selectionRow(store.settings, objectMode);
}

/** checkboxes that switch a setting */
export const SETTING_FLAGS: Record<string, keyof Settings> = {
  "o-snap": "snap",
  "o-both": "stretchBothSides",
  "o-mirror": "mirrorX",
  "o-parts": "selectGroupPartsSeparately",
  "o-sticky": "stayInCreate",
  "o-xray": "xray",
};

export function onSettingChange(b: Build, t: Field): boolean {
  const { commands } = b.deps;
  const flag = SETTING_FLAGS[t.id];
  if (flag) commands.setSettings({ [flag]: (t as HTMLInputElement).checked });
  else if (t.id === "o-axes") commands.setSettings({ axes: t.value as Settings["axes"] });
  else if (t.id === "o-grid") commands.setSettings({ gridMetres: parseFloat(t.value) });
  else return false;
  return true;
}

export const MODE_CLICKS: Clicks = [
  ["[data-shape]", (b, el) => b.deps.commands.setCreateType(el.dataset.shape!)],
  ["[data-mode]", (b, el) => b.deps.commands.setMode(el.dataset.mode as EditMode)],
];

/** the soft-selection radius is applied when the spinner is let go (it only matters for the next drag) */
export function wireSoftRadius(b: Build): void {
  onSpin("soft", (_key, v, phase) => {
    if (phase === "end") b.deps.commands.setSettings({ softRadiusMetres: v });
  });
}
