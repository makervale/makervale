/** One frame of one running script: its timers, who came and went, its threads, and now and then its state. */
import { LuaError, measure, toPlain } from "@/lib/lua";
import type { Obj, ScriptState } from "@/world/model";
import type { Running } from "./running";
import { freshState } from "./running";
import type { ThreadEnv } from "./threads";
import { fire, handles, runThreads, spawn } from "./threads";
import { dueTimers } from "./timers";
import type { Avatar } from "./zones";
import { checkZones } from "./zones";

export interface FrameEnv {
  t: number;
  avatars: Avatar[];
  threads: ThreadEnv;
  fail(id: string, message: string): void;
  /** the script holds too much: it stops */
  stop(id: string, message: string): void;
  /** store the script's state on the object (a script command) and tell the room */
  saveState(o: Obj, state: ScriptState): void;
}

const SAVE_EVERY_S = 0.5;
/** state bigger than this isn't worth sending around on every change */
const MAX_STATE_JSON = 20_000;
const MEASURE_EVERY_S = 2;
/** how much a script may hold, in rough cells (a table entry, 32 characters of text) */
export const MAX_HELD = 200_000;

function saveState(o: Obj, r: Running, env: FrameEnv): void {
  if (env.t <= r.saveAt) return;
  r.saveAt = env.t + SAVE_EVERY_S;
  let json: string;
  let state: unknown;
  try {
    state = toPlain(r.globals.get("state"), "state", 0);
    json = JSON.stringify(state);
  } catch (e) {
    return env.fail(o.id, e instanceof LuaError ? e.message : String(e));
  }
  if (json === r.savedJSON) return;
  if (json.length > MAX_STATE_JSON)
    return env.fail(o.id, `state is too big to keep (at most ${MAX_STATE_JSON} characters as text)`);
  r.savedJSON = json;
  env.saveState(o, { ...(o.scriptState ?? freshState(o, r.src)), state });
}

function checkMemory(o: Obj, r: Running, env: FrameEnv): void {
  if (env.t < r.measureAt) return;
  r.measureAt = env.t + MEASURE_EVERY_S;
  const held = measure([r.globals, ...r.threads.flatMap((th) => th.ctx.stack)], MAX_HELD);
  if (held > MAX_HELD) env.stop(o.id, "this script holds too much (tables or text that keep growing): it stopped");
}

/** returns what is left of the frame's step budget */
export function runFrame(o: Obj, r: Running, budget: number, env: FrameEnv): number {
  dueTimers(r, env.t, (fn, what) => spawn(r, fn, [], what, env.threads));
  checkZones(
    o,
    r,
    env.avatars,
    (h) => handles(r, h),
    (h, who) => fire(r, h, [who], env.threads),
  );
  const left = runThreads(r, env.t, budget, (message) => env.fail(o.id, message));
  saveState(o, r, env);
  checkMemory(o, r, env);
  return left;
}
