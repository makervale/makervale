/**
 * A little sound so the world isn't silent: effects for what you do, footsteps, wind, birds and crickets.
 * All made in the browser (Web Audio), no files. View ▸ Sound on / off mutes it, remembered per browser.
 */
import type { Bus } from "@/app/bus";
import { toast } from "@/ui/toast";
import { Ambience } from "./ambience";
import { effects } from "./effects";
import { nearnessAt, playNote } from "./instruments";
import { SoundEngine } from "./engine";
import type { Walker } from "./steps";
import { StepClock } from "./steps";

export interface SoundDeps {
  bus: Bus;
  /** your avatar, read every frame for footsteps and take-off / landing */
  avatar: { readonly state: Walker };
  /** 0 day … 1 night */
  darkness(): number;
  /** metres from your avatar to an object: far sounds are quieter */
  distanceTo(id: string): number;
  /** is this object a physical body (a ball)? its bumps knock */
  isBody(id: string): boolean;
  /** the newest chat line: no sound for your own */
  lastChat(): { self?: boolean } | undefined;
}

export interface Sound {
  update(dt: number): void;
  /** "locked" until the first tap or key, then the AudioContext's state ("running" when sound can play) */
  state(): string;
}

const PREF_KEY = "pias.sound";
const UNLOCK_EVENTS = ["pointerup", "touchend", "click", "keydown"] as const;
const KNOCK_AUDIBLE_M_S = 0.8;

export function mount(deps: SoundDeps): Sound {
  const engine = new SoundEngine(readPref());
  const ambience = new Ambience(engine);
  const steps = new StepClock();
  // the events browsers accept as "the user did something" for sound; pointerdown is not one of them on touch
  const unlock = () => {
    engine.unlock();
    if (!engine.live) return;
    for (const type of UNLOCK_EVENTS) window.removeEventListener(type, unlock, true);
  };
  for (const type of UNLOCK_EVENTS) window.addEventListener(type, unlock, true);
  document.addEventListener("click", (e) => {
    if ((e.target as HTMLElement).closest("button")) effects.click(engine);
  });
  listen(deps, engine);
  return {
    state: () => engine.ctx?.state ?? "locked",
    update(dt) {
      if (steps.advance(dt, deps.avatar.state)) effects.step(engine);
      ambience.update(dt, deps.darkness());
    },
  };
}

function listen(deps: SoundDeps, engine: SoundEngine): void {
  const { bus } = deps;
  bus.on("object:touched", () => effects.touch(engine));
  bus.on("chat:message", () => {
    if (!deps.lastChat()?.self) effects.message(engine);
  });
  bus.on("pie:open", () => effects.pie(engine));
  bus.on("avatar:bounced", () => effects.boing(engine));
  bus.on("sound:play", ({ id, note, instrument }) => {
    playNote(engine, instrument, note, nearnessAt(deps.distanceTo(id)));
  });
  // a bump is told to both objects; the body's own report (`by` the other one) makes the one knock
  bus.on("object:bumped", ({ id, speed }) => {
    // a gentle touch (rolling onto the next floor) makes no sound
    if (deps.isBody(id) && speed > KNOCK_AUDIBLE_M_S) effects.knock(engine, speed);
  });
  bus.on("room:joined", () => effects.joined(engine));
  bus.on("room:left", () => effects.left(engine));
  let flying = deps.avatar.state.flying;
  bus.on("avatar:changed", () => {
    const now = deps.avatar.state.flying;
    if (now !== flying) (now ? effects.takeOff : effects.land)(engine);
    flying = now;
  });
  bus.on("menu:command", ({ command }) => {
    if (command !== "sound") return;
    engine.setEnabled(!engine.enabled);
    writePref(engine.enabled);
    toast(engine.enabled ? "Sound on" : "Sound off");
  });
}

function readPref(): boolean {
  try {
    return localStorage.getItem(PREF_KEY) !== "0";
  } catch {
    return true;
  }
}

function writePref(on: boolean): void {
  try {
    localStorage.setItem(PREF_KEY, on ? "1" : "0");
  } catch {
    // remembered only until the page closes
  }
}
