/** Every sound effect, by what it means. Quiet and short on purpose: they should be felt more than heard. */
import type { SoundEngine } from "./engine";
import { noise, tone } from "./voices";

const vary = (x: number, by = 0.12): number => x * (1 + (Math.random() * 2 - 1) * by);

export const effects = {
  /** a button */
  click: (a: SoundEngine) => tone(a, { freq: 1900, type: "triangle", gain: 0.035, seconds: 0.03 }),

  /** you touched a scripted object */
  touch: (a: SoundEngine) => {
    tone(a, { freq: 880, gain: 0.09, seconds: 0.7 });
    tone(a, { freq: 1320, gain: 0.05, seconds: 0.55, delay: 0.04 });
  },

  /** someone (or something) said something */
  message: (a: SoundEngine) => tone(a, { freq: 660, to: 990, gain: 0.06, seconds: 0.12 }),

  /** the pie menu opens */
  pie: (a: SoundEngine) => tone(a, { freq: 320, to: 520, gain: 0.06, seconds: 0.08 }),

  joined: (a: SoundEngine) => {
    tone(a, { freq: 523, gain: 0.08, seconds: 0.25 });
    tone(a, { freq: 784, gain: 0.08, seconds: 0.4, delay: 0.12 });
  },

  left: (a: SoundEngine) => {
    tone(a, { freq: 784, gain: 0.07, seconds: 0.25 });
    tone(a, { freq: 523, gain: 0.07, seconds: 0.4, delay: 0.12 });
  },

  takeOff: (a: SoundEngine) => noise(a, { freq: 300, to: 1800, q: 0.8, gain: 0.12, seconds: 0.6 }),

  land: (a: SoundEngine) => {
    tone(a, { freq: 110, to: 55, gain: 0.18, seconds: 0.18 });
    noise(a, { freq: 400, gain: 0.08, seconds: 0.12 });
  },

  /** a trampoline throws you up */
  boing: (a: SoundEngine) => {
    tone(a, { freq: 140, to: 420, type: "triangle", gain: 0.1, seconds: 0.3 });
    tone(a, { freq: 280, to: 840, gain: 0.04, seconds: 0.25, delay: 0.02 });
  },

  /** something struck something: louder the harder it hit */
  knock: (a: SoundEngine, speed: number) => {
    const loud = Math.min(1, speed / 8);
    tone(a, { freq: vary(180), to: 90, gain: 0.04 + 0.12 * loud, seconds: 0.12 });
    noise(a, { freq: vary(900), q: 1.2, gain: 0.03 + 0.06 * loud, seconds: 0.06 });
  },

  /** one footstep; every one a little different */
  step: (a: SoundEngine) => {
    noise(a, { freq: vary(700, 0.25), q: 1.4, gain: vary(0.09), seconds: vary(0.07) });
    tone(a, { freq: vary(90), to: 60, gain: 0.05, seconds: 0.06 });
  },
};

export type Effect = keyof typeof effects;
