/**
 * Files: open and save projects, new and sample scenes, import models, export glTF / OBJ / STL.
 * Everything starts from a "menu:command" (menus, tools, Ctrl+S).
 */
import type { FilesDeps } from "./deps";
import { exportObj, exportStl } from "./export";
import { exportGltf } from "./gltf";
import { importFile } from "./import";
import { loadSample, newScene, openProjectFile, saveProject } from "./project";

export type { FilesDeps } from "./deps";

/** the commands this feature answers */
export const FILE_COMMANDS = ["new", "open", "save", "sample", "import", "export", "export-obj", "export-stl"] as const;
export type FileCommand = (typeof FILE_COMMANDS)[number];

function fileInput(id: string, accept: string, multiple: boolean): HTMLInputElement {
  const input = document.createElement("input");
  input.type = "file";
  input.id = id;
  input.accept = accept;
  input.multiple = multiple;
  input.hidden = true;
  document.getElementById("stage")!.appendChild(input);
  return input;
}

/** the chosen files, with the input cleared so the same file can be chosen again */
function take(input: HTMLInputElement): File[] {
  const files = input.files ? [...input.files] : [];
  input.value = "";
  return files;
}

export function mount(deps: FilesDeps): void {
  const open = fileInput("f-open", ".json,application/json", false);
  const imp = fileInput("f-import", ".obj,.stl,.glb,.gltf", true);
  open.addEventListener("change", () => {
    const [file] = take(open);
    if (file) void openProjectFile(deps, file);
  });
  imp.addEventListener("change", async () => {
    for (const file of take(imp)) await importFile(deps, file);
  });
  const run: Record<FileCommand, () => void> = {
    new: () => newScene(deps),
    open: () => open.click(),
    save: () => saveProject(deps),
    sample: () => loadSample(deps),
    import: () => imp.click(),
    export: () => void exportGltf(deps.store),
    "export-obj": () => void exportObj(deps.store),
    "export-stl": () => void exportStl(deps.store),
  };
  deps.bus.on("menu:command", ({ command }) => {
    if (Object.hasOwn(run, command)) run[command as FileCommand]();
  });
}
