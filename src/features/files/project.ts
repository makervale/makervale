/** Projects: save the scene as JSON, open one, start empty, load the sample scene. */
import { toast } from "@/ui/toast";
import { restingWorld } from "@/world/resting";
import type { FilesDeps } from "./deps";
import { offerFile } from "./download";

const PROJECT_FILE = "makervale.json";
/** the format id inside project files; kept from the project's first name so older files still open */
const FORMAT = "piaskownica";
const VERSION = 4;

export function saveProject(d: FilesDeps): void {
  void offerFile(
    PROJECT_FILE,
    JSON.stringify({ format: FORMAT, version: VERSION, world: restingWorld(d.store.world) }),
  );
}

/** a project file holds `{format, version, world}`; very old ones are the world itself */
export async function openProjectFile(d: FilesDeps, file: File): Promise<void> {
  try {
    const data = JSON.parse(await file.text()) as { world?: unknown };
    const world = d.loadWorld(data.world ?? data);
    if (!world.objects.length) throw new Error("empty");
    d.commands.replaceWorld(world, "Open project");
    toast("Loaded " + file.name);
  } catch {
    toast("This is not a Makervale project file");
  }
}

export function newScene(d: FilesDeps): void {
  d.commands.replaceWorld({ seq: d.store.world.seq, objects: [] }, "New scene");
  toast("Empty scene. Ctrl+Z brings back the previous one.");
}

export function loadSample(d: FilesDeps): void {
  d.commands.replaceWorld(d.sampleWorld(), "Sample scene");
  d.renderer.framing.home(d.store.visibleObjects());
}
