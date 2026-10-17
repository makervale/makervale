/** Threads: each event a script handles, and each timer that fires, runs as a generator stepped a bit per frame. */
import type { Value } from "@/lib/lua";
import { callFunction, isFn, newCtx } from "@/lib/lua";
import type { Running, Thread } from "./running";
import { errorText } from "./running";

/** too much going on: the oldest thread gives way */
const MAX_THREADS = 16;
/** budget a generator step costs, on top of the steps the interpreter counts */
const STEP_COST = 50;

/** where a thread's print() goes, and its dice */
export interface ThreadEnv {
  print(text: string): void;
  random(): number;
}

export function spawn(r: Running, fn: Value, args: Value[], what: string, env: ThreadEnv): void {
  if (r.threads.length >= MAX_THREADS) r.threads.shift();
  const ctx = newCtx(r.globals, env.print, env.random);
  r.threads.push({ gen: callFunction(fn, args, ctx, what), ctx, wake: 0, what });
}

/** run the script's function `name`, if it has one, as a thread of its own */
export function fire(r: Running, name: string, args: Value[], env: ThreadEnv): void {
  const fn = r.globals.get(name);
  if (isFn(fn)) spawn(r, fn, args, name, env);
}

export const handles = (r: Running, name: string): boolean => isFn(r.globals.get(name));

function drop(r: Running, th: Thread): void {
  const i = r.threads.indexOf(th);
  if (i >= 0) r.threads.splice(i, 1);
}

/** one step: run until the thread waits or ends; returns what is left of the budget */
function advance(r: Running, th: Thread, t: number, budget: number): number {
  th.ctx.steps = 0;
  const res = th.gen.next();
  budget -= STEP_COST + th.ctx.steps;
  th.ctx.steps = 0;
  if (res.done) drop(r, th);
  else th.wake = t + Math.max(0, res.value.wait);
  return budget;
}

/** step every thread that is awake; a failing thread stops and reports, the others go on */
export function runThreads(r: Running, t: number, budget: number, fail: (message: string) => void): number {
  for (const th of [...r.threads]) {
    if (th.wake > t) continue;
    if (budget <= 0) break;
    try {
      budget = advance(r, th, t, budget);
    } catch (e) {
      drop(r, th);
      fail(errorText(e));
    }
  }
  return budget;
}
