/** Smooth moves. They play on every computer: the authority starts them, the others replay the same Fx. */
import type { Fx } from "@/net/scripts-bridge";
import type { Vec3 } from "@/lib/vec";
import type { Obj } from "@/world/model";
import type { Pivot, Placement } from "./pose";
import { normalizeQuat, placementOf, poseAt } from "./pose";

interface Tween {
  id: string;
  from: Placement;
  to: Placement;
  startedAt: number;
  seconds: number;
  pivot?: Pivot;
}

export interface TweenDeps {
  now(): number;
  byId(id: string): Obj | undefined;
  /** put the object at `pose`; `final` is the last frame of the move */
  frame(o: Obj, pose: Placement, final: boolean): void;
}

const PIVOT_NUMBERS = 6;

export class Tweens {
  private readonly tweens = new Map<string, Tween>();

  constructor(private readonly deps: TweenDeps) {}

  start(fx: Fx): void {
    const o = this.deps.byId(fx.id);
    if (!o) return;
    const to: Placement = { pos: [...fx.pos], quat: normalizeQuat(fx.quat), size: [...fx.size] };
    const tween: Tween = {
      id: fx.id,
      from: placementOf(o),
      to,
      startedAt: this.deps.now(),
      seconds: Math.max(0, fx.d),
    };
    if (fx.pv && fx.pv.length === PIVOT_NUMBERS) {
      tween.pivot = { world: fx.pv.slice(0, 3) as Vec3, local: fx.pv.slice(3, 6) as Vec3 };
    }
    this.tweens.set(fx.id, tween);
    if (tween.seconds === 0) this.step(tween, 1);
  }

  /** where a moving object is going, or null if it isn't moving */
  target(id: string): Placement | null {
    const tween = this.tweens.get(id);
    return tween ? placementOf(tween.to) : null;
  }

  /** per frame */
  tick(): void {
    const t = this.deps.now();
    for (const tween of [...this.tweens.values()]) {
      this.step(tween, tween.seconds > 0 ? (t - tween.startedAt) / tween.seconds : 1);
    }
  }

  clear(): void {
    this.tweens.clear();
  }

  private step(tween: Tween, k: number): void {
    const o = this.deps.byId(tween.id);
    if (!o) {
      this.tweens.delete(tween.id);
      return;
    }
    const final = k >= 1;
    if (final) this.tweens.delete(tween.id);
    this.deps.frame(o, poseAt(tween.from, tween.to, k, tween.pivot), final);
  }
}
