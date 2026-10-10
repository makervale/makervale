/** Editing options shown as cards: each one toggles a setting. */
import type { Settings } from "@/app/settings";
import type { CatalogTool, ToolApp } from "./app";

/** the radius soft selection starts with when turned on from the card */
const SOFT_RADIUS_M = 0.5;

interface OptionCard {
  id: string;
  name: string;
  synonyms: string[];
  summary: string;
  steps: string[];
  isOn: (s: Settings) => boolean;
  toggled: (s: Settings) => Partial<Settings>;
}

function option(app: ToolApp, o: OptionCard): CatalogTool {
  const isOn = () => o.isOn(app.store.settings);
  return {
    id: o.id,
    name: o.name,
    category: "transform",
    kind: "option",
    need: "none",
    synonyms: o.synonyms,
    summary: o.summary,
    steps: o.steps,
    isOn,
    run: () => {
      app.commands.setSettings(o.toggled(app.store.settings));
      return o.name + ": " + (isOn() ? "on" : "off");
    },
  };
}

const OPTIONS: OptionCard[] = [
  {
    id: "opt-snap",
    name: "Snap to ruler",
    synonyms: ["snap", "snapping", "grid", "grid snap", "increment", "magnet", "even spacing"],
    summary:
      "When on, just slide the cursor off the arrow onto the ruler next to it, and the move jumps along the ticks. The ticks get denser as you zoom in. Key G.",
    steps: ["Turn on snap (G).", "Drag an arrow and slide the cursor onto the ruler."],
    isOn: (s) => s.snap,
    toggled: (s) => ({ snap: !s.snap }),
  },
  {
    id: "opt-mirror",
    name: "Mirror while editing",
    synonyms: ["mirror", "symmetry", "x-mirror", "live mirror", "symmetrical", "both sides"],
    summary: "Move a point on one side of the X axis and its mirror image moves with it.",
    steps: ["Turn on mirror.", "Edit one half of the model."],
    isOn: (s) => s.mirrorX,
    toggled: (s) => ({ mirrorX: !s.mirrorX }),
  },
  {
    id: "opt-soft",
    name: "Soft selection",
    synonyms: ["soft selection", "proportional editing", "proportional", "falloff", "smooth falloff", "sculpt"],
    summary: "Neighbours of the moved points follow them, weaker with distance. Set the radius in the Object tab.",
    steps: ["Turn it on and set the radius in metres.", "Move one point."],
    isOn: (s) => s.softRadiusMetres > 0,
    toggled: (s) => ({ softRadiusMetres: s.softRadiusMetres > 0 ? 0 : SOFT_RADIUS_M }),
  },
];

export const optionTools = (app: ToolApp): CatalogTool[] => OPTIONS.map((o) => option(app, o));
