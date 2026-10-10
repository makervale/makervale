/** What a running handler sees (Ctx) and what it hands back to the runtime (Yield). */
import { ScriptError } from "./ast";
import type { Val } from "./ast";

export interface Ctx {
  /** the script's globals, shared by all its handlers */
  vars: Map<string, Val>;
  /** per-event values: who, heard… */
  local: Record<string, Val>;
  rand: () => number;
  time: () => number;
  /** work done since the runtime last reset it; loops yield once it passes STEP_BUDGET */
  steps: number;
}

export type Yield = { k: "wait"; s: number } | { k: "act"; n: string; a: Val[]; dur: number; line: number };

/** steps a loop may take per frame before it yields */
export const STEP_BUDGET = 4000;
// a script may run many frames without waiting, but not forever
const BUSY_LIMIT = STEP_BUDGET * 50;

export function tick(c: Ctx, line: number): void {
  if (++c.steps > BUSY_LIMIT) {
    throw new ScriptError('this script is busy for too long without waiting (add a "wait")', line);
  }
}
