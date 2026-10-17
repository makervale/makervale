/** every(s, fn) and after(s, fn): functions that run later, once or again and again, as threads of their own. */
import type { Value } from "@/lib/lua";
import { LuaError } from "@/lib/lua";
import type { Running } from "./running";

const MAX_TIMERS = 32;
const MIN_EVERY_S = 0.1;
const MAX_DELAY_S = 3600;

export function addTimer(r: Running, fn: Value, delay: number, every: number, t: number, line: number): number {
  if (r.timers.length >= MAX_TIMERS) throw new LuaError(`too many timers (at most ${MAX_TIMERS}): cancel some`, line);
  const id = r.nextTimer++;
  const gap = every > 0 ? Math.max(MIN_EVERY_S, Math.min(every, MAX_DELAY_S)) : 0;
  r.timers.push({ id, fn, at: t + Math.min(Math.max(0, delay), MAX_DELAY_S), every: gap });
  return id;
}

export function cancelTimer(r: Running, id: number): void {
  r.timers = r.timers.filter((tm) => tm.id !== id);
}

/** starts what is due; a timer whose last run hasn't finished skips a turn rather than pile up */
export function dueTimers(r: Running, t: number, start: (fn: Value, what: string) => void): void {
  for (const tm of [...r.timers]) {
    if (tm.at > t) continue;
    const what = "timer " + tm.id;
    if (!r.threads.some((th) => th.what === what)) start(tm.fn, what);
    if (tm.every > 0) tm.at = Math.max(tm.at + tm.every, t);
    else cancelTimer(r, tm.id);
  }
}
