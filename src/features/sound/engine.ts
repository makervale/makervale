/**
 * The one AudioContext. Browsers only allow sound after the person has tapped or pressed a key, so it is made on
 * the first one. Everything plays through `out`, whose gain mutes it all.
 */

const MASTER_GAIN = 0.6;
const NOISE_SECONDS = 2;
const FADE_S = 0.15;

export class SoundEngine {
  ctx: AudioContext | null = null;
  out: GainNode | null = null;
  private noise: AudioBuffer | null = null;

  constructor(public enabled: boolean) {}

  /** ready to play: unlocked and not muted */
  get live(): boolean {
    return this.enabled && !!this.ctx && this.ctx.state === "running";
  }

  /**
   * Call from a tap's end, a click or a key press: browsers only let a page make sound from inside one of those
   * (on a touch screen a finger going down doesn't count, lifting it does).
   */
  unlock(): void {
    allowWithMuteSwitch();
    if (!this.ctx) {
      const Ctx =
        window.AudioContext ?? (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
      if (!Ctx) return;
      this.ctx = new Ctx();
      this.out = this.ctx.createGain();
      this.out.gain.value = this.enabled ? MASTER_GAIN : 0;
      this.out.connect(this.ctx.destination);
    }
    if (this.ctx.state === "suspended") void this.ctx.resume();
    // older iPhones only open the audio once something has actually played inside the gesture
    playSilence(this.ctx);
  }

  setEnabled(on: boolean): void {
    this.enabled = on;
    if (!this.ctx || !this.out) return;
    this.out.gain.setTargetAtTime(on ? MASTER_GAIN : 0, this.ctx.currentTime, FADE_S);
  }

  /** two seconds of white noise, made once: wind, footsteps and whooshes are all filtered noise */
  noiseBuffer(): AudioBuffer {
    const ctx = this.ctx!;
    if (this.noise) return this.noise;
    const buffer = ctx.createBuffer(1, ctx.sampleRate * NOISE_SECONDS, ctx.sampleRate);
    const data = buffer.getChannelData(0);
    for (let i = 0; i < data.length; i++) data[i] = Math.random() * 2 - 1;
    this.noise = buffer;
    return buffer;
  }
}

/** iPhones mute web pages with the ringer switch unless the page says it plays media (Safari 16.4+) */
function allowWithMuteSwitch(): void {
  const session = (navigator as Navigator & { audioSession?: { type: string } }).audioSession;
  if (session && session.type !== "playback") session.type = "playback";
}

function playSilence(ctx: AudioContext): void {
  const src = ctx.createBufferSource();
  src.buffer = ctx.createBuffer(1, 1, ctx.sampleRate);
  src.connect(ctx.destination);
  src.start();
}
