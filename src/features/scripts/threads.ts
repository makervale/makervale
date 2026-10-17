/** Running handlers a bounded amount per frame, and starting them when events happen. */
import type { Ctx, Handler, Val, Yield } from "@/lib/script";
import { ScriptError, startHandler } from "@/lib/script";
import type { Running, Thread } from "./running";

export type ActYield = Extract<Yield, { k: "act" }>;

/** too much going on: the oldest thread gives way */
const MAX_THREADS = 16;
/** budget a generator step costs, on top of the steps the interpreter counts */
const STEP_COST = 50;

/** start every handler of event `ev` (that `match` accepts) as a new thread */
export function fire(r: Running, ev: string, local: Record<string, Val> = {}, match?: (h: Handler) => boolean): void {
  for (const h of r.prog.handlers) {
    if (h.ev !== ev || (match && !match(h))) continue;
    if (r.threads.length >= MAX_THREADS) r.threads.shift();
    const ctx: Ctx = { ...r.ctx, local: { ...local }, steps: 0 };
    r.threads.push({ gen: startHandler(h, ctx), wake: 0, ev, ctx });
  }
}

function drop(r: Running, th: Thread): void {
  const i = r.threads.indexOf(th);
  if (i >= 0) r.threads.splice(i, 1);
}

export function threadError(e: unknown): string {
  if (e instanceof ScriptError) return e.message;
  return "script stopped: " + (e instanceof Error ? e.message : String(e));
}

/** run until the thread waits, takes time, ends, or the budget is spent; returns what is left of the budget */
function advance(r: Running, th: Thread, t: number, budget: number, act: (y: ActYield) => number): number {
  th.ctx.steps = 0;
  for (;;) {
    const res = th.gen.next();
    // the interpreter's own count of the work done, plus a fixed cost for the step itself
    budget -= STEP_COST + th.ctx.steps;
    th.ctx.steps = 0;
    if (res.done) {
      drop(r, th);
      return budget;
    }
    const y = res.value;
    const seconds = y.k === "wait" ? y.s : act(y);
    if (y.k === "wait" || seconds > 0) {
      th.wake = t + seconds;
      return budget;
    }
    if (budget <= 0) {
      th.wake = t;
      return budget;
    }
  }
}

/** step every thread that is awake; a failing thread stops and reports */
export function runThreads(
  r: Running,
  t: number,
  budget: number,
  act: (y: ActYield) => number,
  fail: (message: string) => void,
): number {
  for (const th of [...r.threads]) {
    if (th.wake > t) continue;
    if (budget <= 0) break;
    try {
      budget = advance(r, th, t, budget, act);
    } catch (e) {
      drop(r, th);
      fail(threadError(e));
    }
  }
  return budget;
}
