/** Materials: giving faces their own material, and texture (UV) layouts. */
import type { ToolContext } from "@/app/tools";
import * as G from "@/lib/mesh/generators";
import { hasUV } from "@/lib/mesh/mesh";
import { boxUV, cylinderUV, smartUV } from "@/lib/mesh/uv";
import { selectedFaces } from "@/lib/mesh/selection";
import { ensureMaterialSlots } from "@/world/model";
import type { CatalogTool } from "./app";
import { intParam, meshOf, objOf, sel, sizeOf, topFaces } from "./helpers";

/** colours new materials cycle through, so each new one is easy to tell apart */
const NEW_COLOURS = ["#b5643c", "#3f6d8f", "#6f8f5a", "#d9a441", "#8c7db3"];

function newMaterialForFaces(c: ToolContext): string {
  const o = objOf(c);
  const m = meshOf(c);
  const faces = selectedFaces(m, c.selection);
  ensureMaterialSlots(o);
  const source = o.materials[m.fm[[...faces][0]]] ?? o.materials[0];
  const slot = o.materials.length;
  o.materials.push({ ...source, name: "Material " + (slot + 1), color: NEW_COLOURS[slot % NEW_COLOURS.length] });
  for (const f of faces) m.fm[f] = slot;
  return "New material: " + o.materials[slot].name;
}

const MATERIAL_TOOLS: CatalogTool[] = [
  {
    id: "newmat",
    name: "New material for faces",
    category: "material",
    need: "faces",
    pie: true,
    synonyms: ["material", "new material", "material slot", "colour faces", "color faces", "paint", "texture part"],
    summary: "Gives the selected faces their own material, which you set up in the Material tab.",
    steps: ["Select faces.", "Pick this card.", "Change the colour and pattern in the Material tab."],
    run: newMaterialForFaces,
    demo: { mesh: () => G.genBox(2), selection: (m) => sel(topFaces(m)), mode: "face" },
    related: ["assignmat", "bymat"],
  },
  {
    id: "assignmat",
    name: "Assign material",
    category: "material",
    need: "faces",
    synonyms: ["assign material", "assign", "apply material", "use material", "set material"],
    summary: "Gives the selected faces one of the object's existing materials.",
    steps: ["Select faces.", "Pick the material number."],
    params: [intParam("slot", "Material no.", 1, 64, 1)],
    run: (c, p) => {
      const o = objOf(c);
      const m = meshOf(c);
      const slot = Math.min(o.materials.length, Math.max(1, p.slot)) - 1;
      for (const f of selectedFaces(m, c.selection)) m.fm[f] = slot;
      return "Assigned: " + o.materials[slot].name;
    },
  },
];

const UV_TOOLS: CatalogTool[] = [
  {
    id: "uvsmart",
    name: "Unwrap UV",
    category: "material",
    need: "mesh",
    synonyms: ["uv", "unwrap", "smart uv project", "uv layout", "texture", "mapping", "seams"],
    summary:
      "Unfolds the mesh into flat pieces and packs them into the texture square. Needed for painting textures in other programs.",
    steps: [
      "Select an object.",
      "Move the mouse to set the angle at which the mesh splits into separate pieces.",
      "You can see the layout in the Material tab.",
    ],
    params: [
      { key: "ang", label: "Split angle", min: 10, max: 89, step: 1, def: 66, decimals: 0, unit: "°" },
      { key: "margin", label: "Margin", min: 0, max: 10, step: 0.5, def: 1, decimals: 1, unit: "%" },
    ],
    live: { param: "ang", mode: "screen" },
    run: (c, p) => `Unwrapped into ${smartUV(meshOf(c), sizeOf(c), p.ang, p.margin / 100)} pieces`,
    demo: { mesh: () => G.genCylinder(12), params: { ang: 66 } },
    demoRun: (c, p) => void smartUV(meshOf(c), sizeOf(c), p.ang, p.margin / 100),
    related: ["uvbox", "uvcyl", "newmat"],
  },
  {
    id: "uvbox",
    name: "Cube UV",
    category: "material",
    need: "mesh",
    synonyms: ["box uv", "cube projection", "box mapping", "projection", "texture in metres", "bricks", "planks"],
    summary:
      "Projects the texture from six sides at metre scale: brick and plank patterns repeat evenly across the whole scene.",
    steps: ["Select an object.", "Choose Cube UV."],
    run: (c) => boxUV(meshOf(c), sizeOf(c)),
    demo: { mesh: () => G.genBox(1) },
    demoRun: (c) => boxUV(meshOf(c), sizeOf(c)),
    related: ["uvsmart", "uvcyl"],
  },
  {
    id: "uvcyl",
    name: "Cylinder UV",
    category: "material",
    need: "mesh",
    synonyms: ["cylinder uv", "cylinder projection", "cylindrical mapping", "label", "wrap", "bottle"],
    summary: "Wraps the texture around the object Z axis, like a label on a bottle.",
    steps: ["Select an object.", "Choose Cylinder UV."],
    run: (c) => cylinderUV(meshOf(c), sizeOf(c)),
    demo: { mesh: () => G.genCylinder(16, 2) },
    demoRun: (c) => cylinderUV(meshOf(c), sizeOf(c)),
    related: ["uvsmart", "uvbox"],
  },
  {
    id: "uvclear",
    name: "Clear UV",
    category: "material",
    need: "mesh",
    synonyms: ["clear uv", "reset uv", "remove uv", "delete uv", "default projection"],
    summary: "Goes back to the default texture projection from three sides.",
    steps: ["Select an object.", "Choose Clear UV."],
    run: (c) => {
      const m = meshOf(c);
      if (!hasUV(m)) return "The object has no UV layout of its own";
      delete m.uv;
    },
    related: ["uvsmart"],
  },
];

export const materialTools = (): CatalogTool[] => MATERIAL_TOOLS;

export const uvTools = (): CatalogTool[] => UV_TOOLS;
