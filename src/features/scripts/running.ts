/** A running script: its Lua globals, its threads and timers, and the bits of state the runtime keeps per object. */
import type { Block, Ctx, Gen, LuaTable, Value } from "@/lib/lua";
import { LuaError } from "@/lib/lua";
import type { Vec3 } from "@/lib/vec";
import type { Obj, RestingLook, ScriptState } from "@/world/model";

export interface Thread {
  gen: Gen<Value[]>;
  ctx: Ctx;
  /** seconds: when it goes on */
  wake: number;
  /** which handler or timer started it ("onTouch", "timer 3"), so the same one doesn't pile up */
  what: string;
}

export interface Timer {
  id: number;
  fn: Value;
  at: number;
  /** seconds between runs; 0 runs once */
  every: number;
}

export interface Running {
  src: string;
  body: Block;
  globals: LuaTable;
  threads: Thread[];
  timers: Timer[];
  nextTimer: number;
  /** people near the object (onNear/onAway) and inside it (onEnter/onLeave) */
  near: Set<string>;
  inside: Set<string>;
  /** metres from the object's surface that count as near */
  reach: number;
  pivot: Vec3;
  lastSay: number;
  says: number;
  /** when the last note played (seconds) */
  lastNote: number;
  sent: { second: number; count: number };
  savedJSON: string;
  saveAt: number;
  measureAt: number;
}

/** a short hash of the source: saved state only comes back for the same script */
export function sourceHash(s: string): string {
  let h = 2166136261;
  for (let i = 0; i < s.length; i++) h = Math.imul(h ^ s.charCodeAt(i), 16777619);
  return (h >>> 0).toString(36);
}

export const errorText = (e: unknown): string =>
  e instanceof LuaError ? e.message : "the script stopped: " + (e instanceof Error ? e.message : String(e));

export function freshState(o: Obj, src: string): ScriptState {
  const look: RestingLook = { materials: structuredClone(o.materials), hidden: o.hidden };
  if (o.spin) look.spin = [...o.spin];
  if (o.label) look.label = o.label;
  return { src: sourceHash(src), state: null, home: { pos: [...o.pos], quat: [...o.quat], size: [...o.size], look } };
}

/** the object's saved state, if it belongs to this very script */
export function savedStateFor(o: Obj, src: string): ScriptState | undefined {
  return o.scriptState && o.scriptState.src === sourceHash(src) ? o.scriptState : undefined;
}

export function newRunning(src: string, body: Block, globals: LuaTable, saved: ScriptState | undefined, t: number): Running {
  return {
    src,
    body,
    globals,
    threads: [],
    timers: [],
    nextTimer: 1,
    near: new Set(),
    inside: new Set(),
    reach: 3,
    pivot: saved?.pivot ? [...saved.pivot] : [0, 0, 0],
    lastSay: 0,
    says: 0,
    lastNote: -1,
    sent: { second: -1, count: 0 },
    savedJSON: JSON.stringify(saved?.state ?? null),
    saveAt: 0,
    measureAt: t,
  };
}
