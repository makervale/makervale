/** Requests that land on the renderer: time of day from the menu, framing the selection from the Tools panel. */
import type { Renderer } from "@/render/renderer";
import { toast } from "@/ui/toast";
import type { Core } from "./core";

const SKY_NOTES = {
  day: "Midday",
  sunset: "Sunset",
  night: "Night: glowing things light up",
  cycle: "A full day every 20 minutes",
};

const FOCUS_DISTANCE_K = 2.4;

export function handleSceneRequests(core: Core, renderer: Renderer): void {
  core.bus.on("sky:set", ({ mode }) => {
    renderer.sky.set(mode);
    toast(SKY_NOTES[mode]);
  });
  core.bus.on("menu:command", ({ command }) => {
    if (command !== "focus") return;
    const objs = core.store.selected();
    if (objs.length) renderer.framing.frame(objs, undefined, FOCUS_DISTANCE_K);
  });
}
