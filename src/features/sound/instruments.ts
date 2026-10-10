/** Notes for objects' scripts (`play 4, "marimba"`), made from a few sine and triangle partials. */
import type { SoundEngine } from "./engine";
import { tone } from "./voices";

const MIDDLE_C_HZ = 261.63;
const LOUDNESS = 0.16;

type Instrument = (a: SoundEngine, hz: number, gain: number) => void;

const INSTRUMENTS: Record<string, Instrument> = {
  /** a glass bell: long and shimmering */
  bell: (a, hz, gain) => {
    tone(a, { freq: hz * 2, gain, seconds: 1.6 });
    tone(a, { freq: hz * 4.01, gain: gain * 0.35, seconds: 0.9 });
    tone(a, { freq: hz * 6.03, gain: gain * 0.12, seconds: 0.5 });
  },
  /** wooden bars: short, round, with the marimba's bright fourth partial */
  marimba: (a, hz, gain) => {
    tone(a, { freq: hz, gain: gain * 1.2, seconds: 0.5 });
    tone(a, { freq: hz * 4, gain: gain * 0.25, seconds: 0.12 });
  },
  /** a plucked string */
  pluck: (a, hz, gain) => {
    tone(a, { freq: hz, type: "triangle", gain, seconds: 0.7 });
    tone(a, { freq: hz * 2, type: "triangle", gain: gain * 0.3, seconds: 0.3 });
  },
};

/** `nearness` 0 (far away) … 1 (right here) */
export function playNote(a: SoundEngine, instrument: string, note: number, nearness: number): void {
  const play = INSTRUMENTS[instrument] ?? INSTRUMENTS.bell;
  play(a, MIDDLE_C_HZ * Math.pow(2, note / 12), LOUDNESS * nearness);
}

/** heard fully within a few metres, fading to nothing far off */
export function nearnessAt(distanceM: number): number {
  return 1 / (1 + Math.max(0, distanceM - 3) / 6);
}
