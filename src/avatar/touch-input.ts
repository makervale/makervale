/** The on-screen joystick and climb buttons, merged with the keys into one frame of input. */
import type { MoveInput } from "./movement";

export interface TouchInput {
  /** -1 back … 1 forward */
  fwd: number;
  /** -1 left … 1 right (turns, like A/D) */
  lr: number;
  /** -1 down, 0, 1 up (while flying) */
  climb: number;
}

export const NO_TOUCH: TouchInput = { fwd: 0, lr: 0, climb: 0 };

const clampUnit = (v: number): number => Math.max(-1, Math.min(1, v));

export function mergeInput(keys: MoveInput, touch: TouchInput): MoveInput {
  return {
    fwd: clampUnit(keys.fwd + touch.fwd),
    lr: clampUnit(keys.lr + touch.lr),
    up: keys.up || touch.climb > 0,
    down: keys.down || touch.climb < 0,
    shift: keys.shift,
  };
}

export const isActive = (t: TouchInput): boolean => t.fwd !== 0 || t.lr !== 0 || t.climb !== 0;
