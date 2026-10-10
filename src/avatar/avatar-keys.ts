/**
 * The avatar's keys. Walk: W/A/S/D or arrows (Shift+A/D sidestep, Shift+W run).
 * Up / jump: Space, E (outside mesh editing) or Page Up; hold it in the air, or tap it twice, to fly.
 * Down: C or Page Down. Fly on/off: F (with nothing selected) or Home.
 * Sitting: movement keys only turn the camera; stand with Space/E/Page Up, or by pressing W twice.
 */
import type { MoveInput } from "./movement";

export interface KeyContext {
  /** E belongs to mesh editing (extrude) while elements are edited */
  editingMesh(): boolean;
  /** F frames the selection when something is selected */
  somethingSelected(): boolean;
}

export interface KeyEventLike {
  code: string;
  ctrlKey: boolean;
  metaKey: boolean;
  altKey: boolean;
}

/** what a key press asks of the avatar */
export type KeyAction = "none" | "toggleFly" | "fly" | "stand" | "sittingHint";

const UP = new Set(["Space", "PageUp", "KeyE"]);
const DOWN = new Set(["KeyC", "PageDown"]);
const WALK = new Set(["KeyW", "KeyS", "KeyA", "KeyD", "ArrowUp", "ArrowDown", "ArrowLeft", "ArrowRight"]);
/** two taps of the jump key closer than this take off */
const DOUBLE_TAP_MS = 320;
/** seated, a second push forward within this stands you up (the first only explains) */
const SIT_NUDGE_MS = 1500;
const HINT_EVERY_MS = 4000;

export class AvatarKeys {
  private readonly held = new Set<string>();
  private lastUp = 0;
  private sitNudge = 0;
  private hintAt = 0;

  constructor(
    private readonly ctx: KeyContext,
    private readonly now: () => number = () => performance.now(),
  ) {}

  /** does this key move the avatar (in the current context)? */
  owns(code: string): boolean {
    return WALK.has(code) || DOWN.has(code) || this.isUp(code) || this.isFly(code);
  }

  /** a key went down: null when it isn't the avatar's, otherwise what to do (repeats do nothing) */
  press(e: KeyEventLike, sitting: boolean, flying: boolean): KeyAction | null {
    if (!this.owns(e.code) || e.ctrlKey || e.metaKey || e.altKey) return null;
    const first = !this.held.has(e.code);
    this.held.add(e.code);
    if (!first) return "none";
    if (this.isFly(e.code)) return "toggleFly";
    if (sitting) return this.pressSeated(e.code);
    if (this.isUp(e.code)) return this.tapUp(flying);
    return "none";
  }

  /** a key went up: true when it was the avatar's */
  release(code: string): boolean {
    this.held.delete(code);
    return this.owns(code);
  }

  clear(): void {
    this.held.clear();
  }

  /** what the held keys mean this frame */
  input(shift: boolean): MoveInput {
    const axis = (plus: string[], minus: string[]) => (this.anyHeld(plus) ? 1 : 0) - (this.anyHeld(minus) ? 1 : 0);
    return {
      fwd: axis(["KeyW", "ArrowUp"], ["KeyS", "ArrowDown"]),
      lr: axis(["KeyD", "ArrowRight"], ["KeyA", "ArrowLeft"]),
      up: this.anyHeld(["Space", "PageUp"]) || (this.held.has("KeyE") && !this.ctx.editingMesh()),
      down: this.anyHeld(["KeyC", "PageDown"]),
      shift,
    };
  }

  private anyHeld(codes: string[]): boolean {
    return codes.some((c) => this.held.has(c));
  }

  /** a fresh seat: the next push forward only explains again */
  seated(): void {
    this.sitNudge = 0;
  }

  private isUp(code: string): boolean {
    return UP.has(code) && !(code === "KeyE" && this.ctx.editingMesh());
  }

  private isFly(code: string): boolean {
    return code === "Home" || (code === "KeyF" && !this.ctx.somethingSelected());
  }

  private pressSeated(code: string): KeyAction {
    if (this.isUp(code)) return "stand";
    const now = this.now();
    if (code === "KeyW" || code === "ArrowUp") {
      if (now - this.sitNudge < SIT_NUDGE_MS) return "stand";
      this.sitNudge = now;
    }
    if (now - this.hintAt <= HINT_EVERY_MS) return "none";
    this.hintAt = now;
    return "sittingHint";
  }

  private tapUp(flying: boolean): KeyAction {
    const now = this.now();
    const double = now - this.lastUp < DOUBLE_TAP_MS && !flying;
    this.lastUp = now;
    return double ? "fly" : "none";
  }
}
