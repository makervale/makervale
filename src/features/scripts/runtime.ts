/**
 * Runs the scripts in the scene. In a room only one computer runs them (the authority); everyone else replays the
 * effects it sends. Alone, you run them. Scripts only change their own object; they talk to other objects with
 * send(). A script's `state` table is kept on its object, so a door that was open stays open when another computer
 * takes over.
 */
import type { Fx, ScriptBridge, ScriptNetHooks } from "@/net/scripts-bridge";
import type { Value } from "@/lib/lua";
import { STEP_BUDGET } from "@/lib/lua";
import type { Obj, ScriptState } from "@/world/model";
import type { ActEnv } from "./actions";
import { act } from "./actions";
import { actEnv } from "./act-env";
import { ScriptConsole } from "./console";
import type { ScriptDeps } from "./deps";
import { performanceSeconds, standaloneHooks } from "./deps";
import { ScriptErrors } from "./errors";
import { ScriptNotes } from "./notes";
import { ACTION_GAS, Gas } from "./gas";
import type { FrameEnv } from "./frame";
import { runFrame } from "./frame";
import type { HostEnv } from "./host";
import type { Placement } from "./pose";
import { placementOf } from "./pose";
import type { Running } from "./running";
import { errorText, freshState, savedStateFor } from "./running";
import { deliver, startScript } from "./start";
import type { ThreadEnv } from "./threads";
import { fire, runThreads } from "./threads";
import { Tweens } from "./tweens";

/** all scripts together may take this many interpreter steps per frame */
const FRAME_BUDGET = STEP_BUDGET * 6;

/** does this object react to clicks? */
export function touchable(o: Obj | undefined): boolean {
  return !!o && typeof o.script === "string" && /\bfunction\s+onTouch\b|\bonTouch\s*=/.test(o.script);
}

export class ScriptRuntime implements ScriptBridge {
  readonly errors: ScriptErrors;
  readonly console: ScriptConsole;
  readonly gas = new Gas();
  hooks: ScriptNetHooks = standaloneHooks();
  readonly running = new Map<string, Running>();
  readonly tweens: Tweens;
  readonly notes: ScriptNotes;
  readonly now: () => number;
  readonly random: () => number;
  private readonly actEnv: ActEnv;

  constructor(readonly deps: ScriptDeps) {
    this.now = deps.now ?? performanceSeconds;
    this.random = deps.random ?? Math.random;
    this.notes = new ScriptNotes(deps.bus);
    this.console = new ScriptConsole(deps.bus);
    this.errors = new ScriptErrors(deps.bus, (id, message) => {
      const o = deps.store.byId(id);
      deps.commands.notice(`Script on "${o ? o.name : id}" stopped: ${message}`);
    });
    this.tweens = new Tweens({ now: this.now, byId: (id) => deps.store.byId(id), frame: (o, p, f) => this.frame(o, p, f) });
    this.actEnv = actEnv(this);
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
    return this.notes.text(id, this.now());
  }

  error(id: string): string {
    return this.errors.get(id);
  }

  output(id: string): string[] {
    return this.console.get(id);
  }

  /** someone clicked an object; away from the authority the touch is forwarded to it */
  touch(id: string, who: string): void {
    if (!this.hooks.isAuthority()) return this.hooks.onForwardTouch(id);
    this.event(id, "onTouch", [who]);
  }

  /** something struck this object (a ball, or the object hit the ground); `who` is the other one's name */
  bump(id: string, who: string): void {
    this.event(id, "onBump", [who]);
  }

  /** someone said something in chat: every script hears it */
  hear(text: string, who: string): void {
    if (!this.hooks.isAuthority()) return;
    for (const id of this.running.keys()) this.event(id, "onHear", [who, text]);
  }

  /** the object's move didn't fit: its script hears onBlocked */
  blocked(id: string): void {
    this.notes.add(id, "blocked", this.now());
    this.event(id, "onBlocked", []);
  }

  private event(id: string, name: string, args: Value[]): void {
    const r = this.running.get(id);
    if (r) fire(r, name, args, this.threadEnv(id));
  }

  threadEnv(id: string): ThreadEnv {
    return { print: (text) => this.console.add(id, text), random: this.random };
  }

  applyEffect(fx: Fx): void {
    this.tweens.start(fx);
  }

  /** where a moving object is going (for the room and for autosave), or null */
  settledTarget(id: string): Placement | null {
    return this.tweens.target(id);
  }

  tweenTarget(id: string): Placement | null {
    return this.tweens.target(id);
  }

  /** start, restart or stop scripts to match the scene */
  resync(): void {
    const authority = this.hooks.isAuthority();
    for (const [id, r] of [...this.running]) {
      const o = this.deps.store.byId(id);
      // no state left: the user edited the object, so the script starts over from where it is now
      if (!authority || o?.script !== r.src || !o.scriptState) this.running.delete(id);
    }
    if (!authority) return;
    for (const o of this.deps.store.world.objects) {
      if (o.script && !this.running.has(o.id) && !this.errors.has(o.id)) this.start(o);
    }
    for (const id of this.errors.ids()) if (!this.deps.store.byId(id)?.script) this.errors.set(id, "");
  }

  /** the script text was edited: try again even if the last version had an error */
  restart(id: string): void {
    this.running.delete(id);
    this.errors.set(id, "");
    this.console.clear(id);
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
    if (this.hooks.isAuthority()) this.runAll();
    this.console.flush();
  }

  private runAll(): void {
    const env = this.frameEnv();
    this.gas.tick(env.t, this.deps.store.world.objects.filter((o) => o.body).length);
    let budget = FRAME_BUDGET;
    for (const [id, r] of [...this.running]) {
      const o = this.deps.store.byId(id);
      if (!o) this.running.delete(id);
      else if (this.gas.tired(id)) this.notes.add(id, "rest", env.t);
      else {
        env.threads = this.threadEnv(id);
        const left = runFrame(o, r, budget, env);
        this.gas.spend(id, budget - left);
        budget = left;
      }
    }
  }

  private fail(id: string, message: string): void {
    this.errors.set(id, message);
    this.console.add(id, "error: " + message);
  }

  private start(o: Obj): void {
    let r: Running;
    try {
      r = startScript(o, { now: this.now(), host: (run) => this.host(o.id, run), threads: this.threadEnv(o.id) });
    } catch (e) {
      return this.fail(o.id, errorText(e));
    }
    this.errors.set(o.id, "");
    // bookkeeping only, nothing to show or send: written in place like the old saves expect
    if (!savedStateFor(o, r.src)) o.scriptState = freshState(o, r.src);
    this.running.set(o.id, r);
    // the top level defines the handlers; then onStart
    runThreads(r, this.now(), FRAME_BUDGET, (m) => this.fail(o.id, m));
    fire(r, "onStart", [], this.threadEnv(o.id));
  }

  private host(id: string, r: Running): HostEnv {
    return {
      now: this.now,
      act: (name, a, dur, line) => {
        const o = this.deps.store.byId(id);
        if (!o) return 0;
        this.gas.spend(id, ACTION_GAS);
        return act({ o, r, a, dur, line, env: this.actEnv }, name);
      },
      avatars: () => this.hooks.avatars(),
      where: () => placementOf(this.tweens.target(id) ?? this.deps.store.byId(id)!).pos,
      send: (to, args, line) => {
        const from = this.deps.store.byId(id)!;
        const receivers = [...this.running]
          .filter(([other]) => other !== id && this.deps.store.byId(other)?.name === to)
          .map(([other, run]): [Running, ThreadEnv] => [run, this.threadEnv(other)]);
        deliver(from, r, this.now(), line, receivers, args);
      },
    };
  }

  private frameEnv(): FrameEnv {
    return {
      t: this.now(),
      avatars: this.running.size ? this.hooks.avatars() : [],
      threads: this.threadEnv(""),
      fail: (id, message) => this.fail(id, message),
      stop: (id, message) => {
        this.running.delete(id);
        this.fail(id, message);
      },
      saveState: (o, state) => this.saveState(o, state),
    };
  }

  private saveState(o: Obj, state: ScriptState): void {
    this.hooks.quietly(() => this.deps.commands.apply([o.id], () => (o.scriptState = state)));
    this.hooks.onChanged([o.id]);
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
