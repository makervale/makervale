/**
 * Runs the scripts in the scene. In a room only one computer runs them (the authority); everyone else replays the
 * effects it sends. Alone, you run them. Scripts only change their own object: move/turn/grow it (smoothly), colour,
 * glow, opacity, show/hide, spin, and say things. Variables and the "home" placement are kept on the object, so a
 * door that was open stays open after a reload or when another computer takes over.
 */
import type { Fx, ScriptBridge, ScriptNetHooks } from "@/net/scripts-bridge";
import { STEP_BUDGET, evalText } from "@/lib/script";
import type { Obj, ScriptState } from "@/world/model";
import type { ActEnv } from "./actions";
import { act } from "./actions";
import type { ScriptDeps } from "./deps";
import { performanceSeconds, standaloneHooks } from "./deps";
import { ScriptErrors } from "./errors";
import { ScriptNotes } from "./notes";
import { ACTION_GAS, Gas } from "./gas";
import type { FrameEnv } from "./frame";
import { runFrame } from "./frame";
import { placementOf } from "./pose";
import type { Placement } from "./pose";
import type { Clock, Running } from "./running";
import { compile, errorText, freshState, savedStateFor } from "./running";
import { fire } from "./threads";
import { Tweens } from "./tweens";

/** all scripts together may take this many interpreter steps per frame */
const FRAME_BUDGET = STEP_BUDGET * 6;

/** does this object react to clicks? */
export function touchable(o: Obj | undefined): boolean {
  return !!o && typeof o.script === "string" && /(^|\n)\s*on\s+touch\b/.test(o.script);
}

export class ScriptRuntime implements ScriptBridge {
  readonly errors: ScriptErrors;
  private hooks: ScriptNetHooks = standaloneHooks();
  private readonly running = new Map<string, Running>();
  private readonly tweens: Tweens;
  readonly gas = new Gas();
  private readonly notes: ScriptNotes;
  private readonly clock: Clock;
  private readonly actEnv: ActEnv;

  constructor(private readonly deps: ScriptDeps) {
    this.clock = { now: deps.now ?? performanceSeconds, random: deps.random ?? Math.random };
    this.notes = new ScriptNotes(deps.bus);
    this.errors = new ScriptErrors(deps.bus, (id, message) => {
      const o = deps.store.byId(id);
      deps.commands.notice(`Script on "${o ? o.name : id}" stopped: ${message}`);
    });
    this.tweens = new Tweens({
      now: this.clock.now,
      byId: (id) => deps.store.byId(id),
      frame: (o, p, f) => this.frame(o, p, f),
    });
    this.actEnv = {
      now: this.clock.now,
      change: (o, fn) => this.change(o, fn),
      go: (_o, fx) => this.go(fx),
      settled: (o) => this.tweens.target(o.id) ?? placementOf(o),
      say: (o, text) => this.hooks.onSay({ id: o.id, name: o.name }, text),
      push: (o, vel) => deps.bus.emit("physics:push", { id: o.id, vel }),
      avatarAt: (name) => this.hooks.avatars().find((a) => a.name === name)?.pos ?? null,
      fits: (o, pose) => deps.commands.space.checkIncoming([{ ...o, ...pose }], []).ok,
      blocked: (o) => {
        const r = this.running.get(o.id);
        this.notes.add(o.id, "blocked", this.clock.now());
        if (r) fire(r, "blocked");
      },
      play: (o, note, instrument) => {
        deps.bus.emit("sound:play", { id: o.id, note, instrument });
        this.hooks.onPlay(o.id, note, instrument);
      },
    };
  }

  connect(hooks: ScriptNetHooks): void {
    this.hooks = hooks;
  }

  /** scripts run, and so are measured, only here: on the authority (alone, always) */
  get measuring(): boolean {
    return this.hooks.isAuthority();
  }

  get runningCount(): number {
    return this.running.size;
  }

  /** what the script just ran into (resting, blocked), if anything */
  note(id: string): string | null {
    return this.notes.text(id, this.clock.now());
  }

  error(id: string): string {
    return this.errors.get(id);
  }

  /** someone clicked an object; away from the authority the touch is forwarded to it */
  touch(id: string, who: string): void {
    if (!this.hooks.isAuthority()) {
      this.hooks.onForwardTouch(id);
      return;
    }
    const r = this.running.get(id);
    if (r) fire(r, "touch", { who });
  }

  /** something struck this object (a ball, or the object hit the ground); `who` is the other one's name */
  bump(id: string, who: string): void {
    const r = this.running.get(id);
    if (r) fire(r, "bump", { who });
  }

  /** someone said something in chat */
  hear(text: string, who: string): void {
    if (!this.hooks.isAuthority()) return;
    const low = text.toLowerCase();
    for (const r of this.running.values()) {
      fire(r, "hear", { who, heard: text }, (h) => {
        const word = evalText(h.arg).toLowerCase();
        return !word || low.includes(word);
      });
    }
  }

  applyEffect(fx: Fx): void {
    this.tweens.start(fx);
  }

  settledTarget(id: string): Placement | null {
    return this.tweens.target(id);
  }

  /** where a moving object is going (for autosave), or null */
  tweenTarget(id: string): Placement | null {
    return this.tweens.target(id);
  }

  /** start, restart or stop scripts to match the scene */
  resync(): void {
    const authority = this.hooks.isAuthority();
    this.stopOutdated(authority);
    if (!authority) return;
    for (const o of this.deps.store.world.objects) {
      if (o.script && !this.running.has(o.id) && !this.errors.has(o.id)) this.start(o);
    }
    for (const id of this.errors.ids()) {
      if (!this.deps.store.byId(id)?.script) this.errors.set(id, "");
    }
  }

  /** scripts whose object is gone or whose text changed stop; all of them when someone else runs scripts */
  private stopOutdated(authority: boolean): void {
    for (const [id, r] of [...this.running]) {
      const o = this.deps.store.byId(id);
      // no state left: the user edited the object, so the script starts over from where it is now
      if (!authority || o?.script !== r.src || !o.scriptState) this.running.delete(id);
    }
  }

  /** the script text was edited: try again even if the last version had an error */
  restart(id: string): void {
    this.running.delete(id);
    this.errors.set(id, "");
    this.resync();
  }

  /** the scene was replaced, or this computer stopped running scripts */
  reset(): void {
    this.running.clear();
    this.tweens.clear();
  }

  /** per frame */
  tick(_dt: number): void {
    this.tweens.tick();
    if (!this.hooks.isAuthority()) return;
    const env = this.frameEnv();
    this.gas.tick(env.t, this.deps.store.world.objects.filter((o) => o.body).length);
    let budget = FRAME_BUDGET;
    for (const [id, r] of this.running) {
      const o = this.deps.store.byId(id);
      if (!o) this.running.delete(id);
      else if (this.gas.tired(id)) this.notes.add(id, "rest", env.t);
      else {
        const left = runFrame(o, r, budget, env);
        this.gas.spend(id, budget - left);
        budget = left;
      }
    }
  }

  private start(o: Obj): void {
    let r: Running;
    try {
      r = compile(o, this.clock);
    } catch (e) {
      this.errors.set(o.id, errorText(e));
      return;
    }
    this.errors.set(o.id, "");
    // bookkeeping only, nothing to show or send: written in place like the old saves expect
    if (!savedStateFor(o, r.src)) o.scriptState = freshState(o, r.src);
    this.running.set(o.id, r);
    fire(r, "start");
  }

  private frameEnv(): FrameEnv {
    return {
      t: this.clock.now(),
      avatars: this.running.size ? this.hooks.avatars() : [],
      act: (o, r, y) => {
        this.gas.spend(o.id, ACTION_GAS);
        return act({ o, r, a: y.a, dur: y.dur, line: y.line, env: this.actEnv }, y.n);
      },
      fail: (id, message) => this.errors.set(id, message),
      saveState: (o, state) => this.saveState(o, state),
    };
  }

  private saveState(o: Obj, state: ScriptState): void {
    this.hooks.quietly(() => this.deps.commands.apply([o.id], () => (o.scriptState = state)));
    this.hooks.onChanged([o.id]);
  }

  private change(o: Obj, fn: (o: Obj) => void): void {
    this.hooks.quietly(() => this.deps.commands.apply([o.id], () => fn(o)));
    this.hooks.onChanged([o.id]);
  }

  private go(fx: Fx): void {
    this.tweens.start(fx);
    this.hooks.onMoved(fx);
  }

  private frame(o: Obj, pose: Placement, final: boolean): void {
    const place = () => Object.assign(o, pose);
    if (final) this.hooks.quietly(() => this.deps.commands.apply([o.id], place));
    else
      this.hooks.quietly(() => {
        place();
        this.deps.commands.dragging([o.id]);
      });
  }
}
