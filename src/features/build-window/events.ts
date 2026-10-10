/** The Build window's clicks, changes and typing, handed to the part they belong to. */
import type { Build, Clicks, Field } from "./context";
import { dispatchClick } from "./context";
import { LAST_OP_CLICKS, onLastOptChange } from "./last-op";
import { MATERIAL_CLICKS, onMaterialInput } from "./material-edit";
import { MODE_CLICKS, onSettingChange } from "./mode-block";
import { onNameChange } from "./object-edit";
import { SCENE_CLICKS } from "./scene-tab";
import { onTemplateChange, SCRIPT_CLICKS } from "./script-edit";
import { TAB_CLICKS } from "./tabs";
import { TOOLBAR_CLICKS } from "./toolbar";

/** order matters where buttons sit inside clickable rows (the eye and lock inside a Scene row) */
const CLICKS: Clicks = [
  ...TOOLBAR_CLICKS,
  ...MODE_CLICKS,
  ...LAST_OP_CLICKS,
  ...TAB_CLICKS,
  ...SCRIPT_CLICKS,
  ...MATERIAL_CLICKS,
  ...SCENE_CLICKS,
];

const CHANGES = [onSettingChange, onLastOptChange, onNameChange, onTemplateChange];

function onChange(b: Build, t: Field): void {
  for (const handle of CHANGES) if (handle(b, t)) return;
  onMaterialInput(b, t, "end");
}

export function wireEvents(b: Build): void {
  b.root.addEventListener("click", (e) => dispatchClick(b, CLICKS, e));
  b.root.addEventListener("change", (e) => onChange(b, e.target as Field));
  b.root.addEventListener("input", (e) => {
    const t = e.target as HTMLInputElement;
    if (t.id === "mt-color") onMaterialInput(b, t, "live");
  });
}
