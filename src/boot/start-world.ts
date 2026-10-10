/**
 * The scene you start with: your autosaved one, else the start plaza. Your own scene is saved in this browser as you
 * work (rooms are saved by the room code instead), with scripted objects at rest (world/resting.ts).
 *
 * The save remembers which version of the start plaza it began from, and whether you changed anything. When the
 * plaza gets new things, an untouched save is simply replaced by the new plaza; your own work is kept, and the new
 * plaza is offered.
 */
import type { Core } from "./core";
import { SAMPLE_VERSION, sampleWorld } from "@/world/sample";
import { loadWorld } from "@/world/migrate";
import type { World } from "@/world/model";
import { restingWorld } from "@/world/resting";
import { toast } from "@/ui/toast";

const SAVE_KEY = "pias.world.v9";
/** the save of the version before; read when there is no newer one */
const OLDER_KEY = "pias.world.v8";
const SAVE_DELAY_MS = 600;
const OFFER_DELAY_MS = 1500;
/** a long message with a choice in it: give people time to read it */
const OFFER_HOLD_MS = 15000;

/** where the scene in front of you came from */
export interface Origin {
  /** the start plaza's version it began as */
  sample: number;
  /** you changed something by hand since */
  edited: boolean;
}

interface Saved extends Origin {
  world: World;
}

export interface AutosaveDeps {
  /** false while you are in someone's room */
  inOwnScene(): boolean;
}

function readSaved(key: string): Saved | null {
  try {
    const raw = JSON.parse(localStorage.getItem(key) || "null");
    const world = raw ? loadWorld(raw) : null;
    if (!world || !world.objects.length) return null;
    // a save from before this was recorded may hold your work: treat it as edited, so it's never replaced unasked
    return { world, sample: Number(raw.sample) || 0, edited: raw.edited !== false };
  } catch {
    return null;
  }
}

export function startWorld(core: Core): Origin {
  const saved = readSaved(SAVE_KEY) ?? readSaved(OLDER_KEY);
  if (!saved) return startFresh(core);
  if (saved.sample < SAMPLE_VERSION && !saved.edited) return startFresh(core);
  // a save from before versions were recorded that holds only the plaza's own things: it is the old plaza
  if (saved.sample === 0 && onlyPlazaThings(saved.world)) {
    const origin = startFresh(core);
    setTimeout(() => offerPrevious(core, saved.world), OFFER_DELAY_MS);
    return origin;
  }
  core.commands.replaceWorld(saved.world, "Start", false);
  const origin: Origin = { sample: saved.sample, edited: saved.edited };
  if (saved.sample < SAMPLE_VERSION) setTimeout(() => offerNewPlaza(core, origin), OFFER_DELAY_MS);
  return origin;
}

function startFresh(core: Core): Origin {
  core.commands.replaceWorld(sampleWorld(), "Start", false);
  return { sample: SAMPLE_VERSION, edited: false };
}

/** names the start plaza used in earlier versions */
const RETIRED_PLAZA_NAMES = ["North goal net", "South goal net"];

/** nothing in it that the plaza doesn't have (anything you made gets a name of its own: Cube, Cylinder…) */
function onlyPlazaThings(w: World): boolean {
  const plaza = new Set([...sampleWorld().objects.map((o) => o.name), ...RETIRED_PLAZA_NAMES]);
  return w.objects.every((o) => plaza.has(o.name));
}

function offerPrevious(core: Core, previous: World): void {
  toast("The start plaza has new things: a football pitch, a trampoline and chimes.", {
    label: "Open my previous scene",
    holdMs: OFFER_HOLD_MS,
    // undoable: Ctrl+Z brings the new plaza back
    run: () => core.commands.replaceWorld(previous, "Previous scene", true),
  });
}

function offerNewPlaza(core: Core, origin: Origin): void {
  const message =
    "The start plaza has new things: a football pitch behind the rotunda, a trampoline and chimes. " +
    "Your own scene is kept here.";
  toast(message, {
    label: "Load the new plaza",
    holdMs: OFFER_HOLD_MS,
    run: () => {
      // undoable: Ctrl+Z brings your scene back
      core.commands.replaceWorld(sampleWorld(), "New start plaza", true);
      Object.assign(origin, { sample: SAMPLE_VERSION, edited: false });
    },
  });
}

export function autosave(core: Core, deps: AutosaveDeps, origin: Origin): void {
  let timer = 0;
  const save = () => {
    if (!deps.inOwnScene()) return;
    try {
      localStorage.setItem(SAVE_KEY, JSON.stringify({ ...restingWorld(core.store.world), ...origin }));
    } catch {
      // storage full or unavailable: autosave is a convenience
    }
  };
  // anything you do by hand (a tool, a drag, an undo) makes the scene your own
  core.bus.on("history:changed", ({ entry }) => {
    if (entry) origin.edited = true;
  });
  const later = () => {
    clearTimeout(timer);
    timer = window.setTimeout(save, SAVE_DELAY_MS);
  };
  core.bus.on("world:changed", later);
  // once at the start too, so the save records where this scene came from
  later();
}
