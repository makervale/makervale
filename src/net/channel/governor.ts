/**
 * How fast the relay channel may publish. Public relays limit how often one connection may publish and say so
 * ("rate-limited: …"); instead of failing, the channel slows down a step when they complain, and speeds up again a
 * step after a calm spell. A slower step costs only smoothness: the outbox keeps just the latest avatar, drag and
 * ball positions, so a longer wait sends fewer of them, while edits and chat are always sent, in order.
 */

/** time between batches at each step (the first is the normal pace) */
export const STEPS_MS = [250, 500, 1000, 2000];
/** complaints this close to the last step count as the same burst */
const STEP_GAP_MS = 3000;
/** this long without a complaint before speeding up a step */
const CALM_MS = 12_000;
/** spread, so peers that slowed down together don't all speed up together */
const JITTER_MS = 4000;

const RATE_LIMITED = /rate|limit|slow ?down|too (many|fast|often)|throttl/i;

/** is this relay's refusal about publishing too fast? */
export const isRateLimit = (reason: unknown): boolean => typeof reason === "string" && RATE_LIMITED.test(reason);

export class Governor {
  private step = 0;
  private lastComplaint = -Infinity;
  private lastChange = -Infinity;
  private calm = CALM_MS + Math.random() * JITTER_MS;

  get level(): number {
    return this.step;
  }

  get pauseMs(): number {
    return STEPS_MS[this.step];
  }

  complaint(now: number): void {
    this.lastComplaint = now;
    if (now - this.lastChange < STEP_GAP_MS) return;
    if (this.step < STEPS_MS.length - 1) this.change(this.step + 1, now);
  }

  /** before each batch: a calm spell is over, speed up a step */
  tick(now: number): void {
    if (!this.step || now - this.lastComplaint < this.calm || now - this.lastChange < this.calm) return;
    this.change(this.step - 1, now);
  }

  private change(step: number, now: number): void {
    this.step = step;
    this.lastChange = now;
    this.calm = CALM_MS + Math.random() * JITTER_MS;
  }
}
