/** One frame of one running script: timers, `near`, the threads, and now and then saving its variables. */
import type { Obj, ScriptState } from "@/world/model";
import type { Avatar } from "./near";
import { checkNear } from "./near";
import type { Running } from "./running";
import { freshState } from "./running";
import type { ActYield } from "./threads";
import { fire, runThreads } from "./threads";

export interface FrameEnv {
  t: number;
  avatars: Avatar[];
  act(o: Obj, r: Running, y: ActYield): number;
  fail(id: string, message: string): void;
  /** store the script's state on the object (a script command) and tell the room */
  saveState(o: Obj, state: ScriptState): void;
}

const SAVE_EVERY_S = 0.5;
/** variables bigger than this aren't worth sending around on every change */
const MAX_SAVED_JSON = 20000;

function timers(r: Running, t: number): void {
  if (r.timerEvery <= 0 || t < r.timerNext) return;
  r.timerNext = t + r.timerEvery;
  if (!r.threads.some((th) => th.ev === "timer")) fire(r, "timer");
}

function saveVars(o: Obj, r: Running, env: FrameEnv): void {
  if (env.t <= r.saveAt) return;
  r.saveAt = env.t + SAVE_EVERY_S;
  const vars = Object.fromEntries(r.ctx.vars);
  const json = JSON.stringify(vars);
  if (json === r.savedJSON || json.length >= MAX_SAVED_JSON) return;
  r.savedJSON = json;
  env.saveState(o, { ...(o.scriptState ?? freshState(o, r.src)), vars });
}

/** returns what is left of the frame's step budget */
export function runFrame(o: Obj, r: Running, budget: number, env: FrameEnv): number {
  timers(r, env.t);
  checkNear(o, r, env.avatars, (h, who) => fire(r, "near", { who }, (x) => x === h));
  const left = runThreads(
    r,
    env.t,
    budget,
    (y) => env.act(o, r, y),
    (message) => env.fail(o.id, message),
  );
  saveVars(o, r, env);
  return left;
}
