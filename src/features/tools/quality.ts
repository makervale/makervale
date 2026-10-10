/**
 * Quality & export: cards that ask another feature to do something (the mesh report, files). They only send a
 * "menu:command" on the bus; the files feature and the report window act on it.
 */
import type { CatalogTool, ToolApp } from "./app";

interface CommandCard {
  id: string;
  name: string;
  /** the menu:command it sends */
  command: string;
  synonyms: string[];
  summary: string;
  steps: string[];
  related?: string[];
}

function commandTool(app: ToolApp, s: CommandCard): CatalogTool {
  const { command, ...card } = s;
  return {
    ...card,
    category: "quality",
    kind: "command",
    need: "none",
    run: () => app.bus.emit("menu:command", { command }),
  };
}

const CHECK: CommandCard = {
  id: "check",
  name: "Check mesh",
  command: "report",
  synonyms: [
    ...["check", "validate", "errors", "mesh analysis", "3d print", "game engine", "limits"],
    "triangle count",
  ],
  summary: "Shows mesh problems and whether the object meets the requirements of game engines and 3D printing.",
  steps: ["Select objects, or nothing (then the whole scene).", "Click a problem in the report to select it."],
  related: ["recalc", "boundary", "weld"],
};

const EXPORT_GLTF: CommandCard = {
  id: "export",
  name: "Export glTF",
  command: "export",
  synonyms: ["export", "gltf", "glb", "save model", "unity", "godot", "unreal"],
  summary: "Saves the scene as a .glb file with materials. Open it in Blender, Unity, Godot or Unreal.",
  steps: ["Optional: Set pivot and Apply size.", "Export glTF."],
};

const FILE_CARDS: CommandCard[] = [
  {
    id: "import",
    name: "Import model",
    command: "import",
    synonyms: ["import", "load", "open model", "obj", "stl", "glb", "gltf", "from blender"],
    summary: "Loads OBJ, STL and glTF/GLB models as editable objects. Triangles are merged into quads where possible.",
    steps: ["Choose a file.", "The model appears in the scene; for large meshes use Decimate."],
    related: ["cleanup", "decimate", "export"],
  },
  {
    id: "exportstl",
    name: "Export STL (3D print)",
    command: "export-stl",
    synonyms: ["stl", "3d print", "printer", "slicer", "cura", "prusa", "export"],
    summary: "Saves the selected objects (or the whole scene) as STL in millimetres, ready for a slicer.",
    steps: ["Check mesh with the 3D print profile.", "Export STL."],
    related: ["check", "solidify"],
  },
  {
    id: "exportobj",
    name: "Export OBJ",
    command: "export-obj",
    synonyms: ["obj", "wavefront", "export", "blender", "with quads", "mtl"],
    summary: "Saves the scene as OBJ with materials and UV layout. Quads stay quads.",
    steps: ["Optionally unwrap UV.", "Export OBJ (a .zip file with .obj and .mtl)."],
    related: ["export", "uvsmart"],
  },
];

export const reportTools = (app: ToolApp): CatalogTool[] => [CHECK, EXPORT_GLTF].map((s) => commandTool(app, s));

export const fileTools = (app: ToolApp): CatalogTool[] => FILE_CARDS.map((s) => commandTool(app, s));
