/** Import model files (OBJ, STL, glTF binary) as new objects, selected and in view. */
import { parseGLB, parseOBJ, parseSTL } from "@/lib/mesh/io";
import { toast } from "@/ui/toast";
import type { FilesDeps } from "./deps";
import type { ImportItem } from "./import-objects";
import { objectsFromItems } from "./import-objects";

const DEFAULT_COLOR = "#c9c4b8";
const FRAME_K = 2.4;

async function itemsOf(file: File, ext: string): Promise<ImportItem[] | null> {
  if (ext === "obj") {
    return parseOBJ(await file.text()).map((o) => ({
      name: o.name,
      mesh: o.mesh,
      matrix: null,
      materials: o.materials.map((name) => ({ name, color: DEFAULT_COLOR })),
    }));
  }
  if (ext === "stl") {
    const mesh = parseSTL(await file.arrayBuffer());
    return [{ name: file.name.replace(/\.stl$/i, ""), mesh, matrix: null, materials: [] }];
  }
  if (ext === "glb" || ext === "gltf") return parseGLB(await file.arrayBuffer());
  return null;
}

export async function importFile(d: FilesDeps, file: File): Promise<void> {
  const ext = (file.name.split(".").pop() || "").toLowerCase();
  toast("Loading " + file.name + "…");
  try {
    const items = await itemsOf(file, ext);
    if (!items) {
      toast("Supported formats: OBJ, STL, GLB");
      return;
    }
    if (!items.every((i) => i.mesh.f.length)) toast("Some meshes were empty");
    addToScene(d, items, file.name);
  } catch (e) {
    console.error(e);
    toast("Could not load " + file.name);
  }
}

function addToScene(d: FilesDeps, items: ImportItem[], fileName: string): void {
  const { store, commands } = d;
  const made = objectsFromItems(store.world, items, fileName);
  commands.act("Import " + fileName, [], () => store.world.objects.push(...made));
  commands.selectObjects(made.map((o) => o.id));
  commands.setMode("object");
  if (!made.length) return;
  d.renderer.framing.frame(made, undefined, FRAME_K);
  const faces = made.reduce((n, o) => n + o.mesh.f.length, 0);
  toast(`Loaded ${made.length} ${made.length === 1 ? "object" : "objects"}: ${faces} faces`);
}
