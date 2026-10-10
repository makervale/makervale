/**
 * When the Build window may be open: it starts closed (you start in the world), comes back open next time if you
 * left it open, opens when a tool is used, and stays closed in rooms where only the host may build.
 */
import { toast } from "@/ui/toast";
import { isOpen, onWindowToggled, showWindow } from "@/ui/window";
import type { BuildWindowDeps } from "./deps";

const OPEN_KEY = "pias.build";

function remember(open: boolean): void {
  try {
    localStorage.setItem(OPEN_KEY, open ? "1" : "0");
  } catch {
    /* fine: it just won't be remembered */
  }
}

function wasOpen(): boolean {
  try {
    return localStorage.getItem(OPEN_KEY) === "1";
  } catch {
    return false;
  }
}

export function wireGating(deps: BuildWindowDeps): void {
  const gate = () => {
    if (deps.room.canIBuild() || !isOpen("build")) return;
    showWindow("build", false);
    toast("Only the host can build in this room.");
  };
  onWindowToggled((id, open) => {
    if (id !== "build") return;
    remember(open);
    if (open) gate();
  });
  deps.bus.on("build:allowed", ({ allowed }) => {
    if (!allowed) gate();
  });
  // using a tool means building
  deps.bus.on("tool:use", () => {
    if (!isOpen("build")) showWindow("build", true);
  });
  if (wasOpen()) showWindow("build", true);
}
