/**
 * The world's own sound: a soft wind that rises and falls, birds now and then by day, crickets at night.
 * Kept far below the effects; it is there so the world doesn't feel dead, not to be listened to.
 */
import type { SoundEngine } from "./engine";
import { tone } from "./voices";

const WIND_GAIN = 0.035;
const WIND_LOWPASS_HZ = 420;
/** how often the wind changes its strength, seconds */
const GUST_EVERY_S = 3;
/** chances per second */
const BIRD_RATE = 0.22;
const CRICKET_RATE = 0.5;

export class Ambience {
  private wind: GainNode | null = null;
  private gustIn = 0;

  constructor(private readonly a: SoundEngine) {}

  /** per frame; `darkness` 0 day … 1 night */
  update(dt: number, darkness: number): void {
    if (!this.a.live) return;
    if (!this.wind) this.wind = this.startWind();
    this.gust(dt);
    if (darkness < 0.4 && Math.random() < BIRD_RATE * dt) chirp(this.a);
    if (darkness > 0.6 && Math.random() < CRICKET_RATE * dt) cricket(this.a);
  }

  private startWind(): GainNode {
    const ctx = this.a.ctx!;
    const src = ctx.createBufferSource();
    src.buffer = this.a.noiseBuffer();
    src.loop = true;
    const filter = ctx.createBiquadFilter();
    filter.type = "lowpass";
    filter.frequency.value = WIND_LOWPASS_HZ;
    const gain = ctx.createGain();
    gain.gain.value = 0;
    src.connect(filter).connect(gain).connect(this.a.out!);
    src.start();
    return gain;
  }

  private gust(dt: number): void {
    this.gustIn -= dt;
    if (this.gustIn > 0) return;
    this.gustIn = GUST_EVERY_S * (0.5 + Math.random());
    const strength = WIND_GAIN * (0.4 + Math.random() * 0.6);
    this.wind!.gain.setTargetAtTime(strength, this.a.ctx!.currentTime, GUST_EVERY_S / 2);
  }
}

/** two to four quick rising whistles */
function chirp(a: SoundEngine): void {
  const base = 2600 + Math.random() * 1400;
  const notes = 2 + Math.floor(Math.random() * 3);
  for (let i = 0; i < notes; i++) {
    tone(a, { freq: base, to: base * 1.25, gain: 0.012, seconds: 0.07, delay: i * 0.11 });
  }
}

/** a short trill, high and thin */
function cricket(a: SoundEngine): void {
  const freq = 4300 + Math.random() * 500;
  for (let i = 0; i < 5; i++) tone(a, { freq, type: "triangle", gain: 0.006, seconds: 0.03, delay: i * 0.045 });
}
