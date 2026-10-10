/** Small building blocks: a tone or a burst of filtered noise with a quick attack and an exponential fade. */
import type { SoundEngine } from "./engine";

export interface Tone {
  freq: number;
  /** glide to this frequency over the sound's length */
  to?: number;
  type?: OscillatorType;
  gain: number;
  seconds: number;
  /** start this long from now */
  delay?: number;
}

export interface Noise {
  /** band-pass centre, Hz; `to` sweeps it */
  freq: number;
  to?: number;
  q?: number;
  gain: number;
  seconds: number;
  delay?: number;
}

const ATTACK_S = 0.008;
const SILENT = 0.0001;

function envelope(a: SoundEngine, gain: number, start: number, seconds: number): GainNode {
  const g = a.ctx!.createGain();
  g.gain.setValueAtTime(SILENT, start);
  g.gain.exponentialRampToValueAtTime(gain, start + ATTACK_S);
  g.gain.exponentialRampToValueAtTime(SILENT, start + seconds);
  g.connect(a.out!);
  return g;
}

export function tone(a: SoundEngine, t: Tone): void {
  if (!a.live) return;
  const ctx = a.ctx!;
  const start = ctx.currentTime + (t.delay ?? 0);
  const osc = ctx.createOscillator();
  osc.type = t.type ?? "sine";
  osc.frequency.setValueAtTime(t.freq, start);
  if (t.to) osc.frequency.exponentialRampToValueAtTime(t.to, start + t.seconds);
  osc.connect(envelope(a, t.gain, start, t.seconds));
  osc.start(start);
  osc.stop(start + t.seconds + 0.05);
}

export function noise(a: SoundEngine, n: Noise): void {
  if (!a.live) return;
  const ctx = a.ctx!;
  const start = ctx.currentTime + (n.delay ?? 0);
  const src = ctx.createBufferSource();
  src.buffer = a.noiseBuffer();
  const filter = ctx.createBiquadFilter();
  filter.type = "bandpass";
  filter.Q.value = n.q ?? 1;
  filter.frequency.setValueAtTime(n.freq, start);
  if (n.to) filter.frequency.exponentialRampToValueAtTime(n.to, start + n.seconds);
  src.connect(filter).connect(envelope(a, n.gain, start, n.seconds));
  // a random place in the buffer, so no two bursts sound the same
  src.start(start, Math.random() * 1.5);
  src.stop(start + n.seconds + 0.05);
}
