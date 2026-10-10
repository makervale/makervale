/** When feet touch the ground: one step per stride, strides quicker the faster you go. */

/** metres covered by one step */
const STRIDE_M = 0.75;
/** below this speed the avatar is standing, not walking (turning on the spot makes no steps) */
const MIN_SPEED = 0.4;

export interface Walker {
  speed: number;
  onGround: boolean;
  flying: boolean;
  sitting: boolean;
}

export class StepClock {
  private travelled = 0;

  /** advance by one frame; true when a foot lands now */
  advance(dt: number, w: Walker): boolean {
    if (!w.onGround || w.flying || w.sitting || w.speed < MIN_SPEED) {
      // the first step after standing still comes quickly
      this.travelled = STRIDE_M * 0.7;
      return false;
    }
    this.travelled += w.speed * dt;
    if (this.travelled < STRIDE_M) return false;
    this.travelled -= STRIDE_M;
    return true;
  }
}
