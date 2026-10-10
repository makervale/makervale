/** A compiled, running script: its program, globals, threads and the bits of state the runtime keeps per object. */
import type { Ctx, Program, Val, Yield } from "@/lib/script";
import { ScriptError, evalArg, initGlobals, parse } from "@/lib/script";
import type { Vec3 } from "@/lib/vec";
import type { Obj, RestingLook, ScriptState } from "@/world/model";

export interface Thread {
  gen: Generator<Yield, unknown, void>;
  wake: number;
  ev: string;
  ctx: Ctx;
}

export interface Running {
  src: string;
  prog: Program;
  ctx: Ctx;
  threads: Thread[];
  timerEvery: number;
  timerNext: number;
  /** per `on near` handler: who is already inside */
  near: Map<number, Set<string>>;
  pivot: Vec3;
  startedAt: number;
  lastSay: number;
  says: number;
  /** when the last note played (seconds) */
  lastNote: number;
  savedJSON: string;
  saveAt: number;
}

const MIN_TIMER_S = 0.1;

/** a short hash of the source: saved variables only come back for the same script */
export function sourceHash(s: string): string {
  let h = 2166136261;
  for (let i = 0; i < s.length; i++) h = Math.imul(h ^ s.charCodeAt(i), 16777619);
  return (h >>> 0).toString(36);
}

export const errorText = (e: unknown): string => (e instanceof ScriptError ? e.message : String(e));

export function freshState(o: Obj, src: string): ScriptState {
  const look: RestingLook = { materials: structuredClone(o.materials), hidden: o.hidden };
  if (o.spin) look.spin = [...o.spin];
  return { src: sourceHash(src), vars: {}, home: { pos: [...o.pos], quat: [...o.quat], size: [...o.size], look } };
}

/** the object's saved state, if it belongs to this very script */
export function savedStateFor(o: Obj, src: string): ScriptState | undefined {
  return o.scriptState && o.scriptState.src === sourceHash(src) ? o.scriptState : undefined;
}

export interface Clock {
  now(): number;
  random(): number;
}

/** parse and initialise; throws a ScriptError (or any error) when the script can't start */
export function compile(o: Obj, clock: Clock): Running {
  const src = o.script ?? "";
  const prog = parse(src);
  const startedAt = clock.now();
  const ctx: Ctx = { vars: new Map(), local: {}, rand: clock.random, time: () => clock.now() - startedAt, steps: 0 };
  initGlobals(prog, ctx);
  const saved = savedStateFor(o, src);
  if (saved) restoreVars(ctx.vars, saved.vars);
  const timerHandler = prog.handlers.find((h) => h.ev === "timer");
  const timerEvery = saved?.timer ?? (timerHandler ? Math.max(MIN_TIMER_S, evalArg(timerHandler.arg, ctx, 1)) : 0);
  return {
    src,
    prog,
    ctx,
    threads: [],
    timerEvery,
    timerNext: startedAt + timerEvery,
    near: new Map(),
    pivot: saved?.pivot ? [...saved.pivot] : [0, 0, 0],
    startedAt,
    lastSay: 0,
    says: 0,
    lastNote: -1,
    savedJSON: JSON.stringify(saved?.vars ?? {}),
    saveAt: 0,
  };
}

/** only variables the script still declares come back */
function restoreVars(vars: Map<string, Val>, saved: Record<string, Val>): void {
  for (const [k, v] of Object.entries(saved)) if (vars.has(k)) vars.set(k, v);
}
