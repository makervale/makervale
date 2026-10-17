/** The loops. After each pass a loop that has done a frame's worth of work lets the frame go (waits 0). */
import type { Block, Stmt } from "./ast";
import type { Signal } from "./call";
import { STEP_BUDGET, callValue, inScope, runBody, scoped } from "./call";
import { fail } from "./errors";
import { evalExpr, evalList } from "./eval";
import type { Ctx, Gen, Scope, Value } from "./table";
import { tonum, truthy } from "./values";

type Of<K extends Stmt["k"]> = Extract<Stmt, { k: K }>;

/** one pass of a loop's body: "stop" after a break, a return to pass on, or undefined to go on */
function* pass(body: Block, s: Scope, c: Ctx, locals: [string, Value][] = []): Gen<Signal | "stop"> {
  const sig = yield* inScope(body, s, c, locals);
  if (sig === "break") return "stop";
  if (sig === "continue") return undefined;
  if (c.steps > STEP_BUDGET) yield { wait: 0 };
  return sig;
}

export function* whileLoop(st: Of<"while">, s: Scope, c: Ctx): Gen<Signal> {
  while (truthy(yield* evalExpr(st.c, s, c))) {
    const r = yield* pass(st.body, s, c);
    if (r) return r === "stop" ? undefined : r;
  }
  return undefined;
}

/** repeat … until: the condition sees the body's locals, so it runs in the body's scope */
export function* repeatLoop(st: Of<"repeat">, s: Scope, c: Ctx): Gen<Signal> {
  for (;;) {
    const r = yield* scoped(s, c, [], function* (scope): Gen<Signal | "stop"> {
      const sig = yield* runBody(st.body, scope, c);
      if (sig === "break") return "stop";
      if (sig && sig !== "continue") return sig;
      return truthy(yield* evalExpr(st.c, scope, c)) ? "stop" : undefined;
    });
    if (r) return r === "stop" ? undefined : r;
    if (c.steps > STEP_BUDGET) yield { wait: 0 };
  }
}

function* number(e: Parameters<typeof evalExpr>[0], s: Scope, c: Ctx, what: string, line: number): Gen<number> {
  const n = tonum(yield* evalExpr(e, s, c));
  return n === null ? fail(`the for loop's ${what} must be a number`, line) : n;
}

export function* forNum(st: Of<"fornum">, s: Scope, c: Ctx): Gen<Signal> {
  const from = yield* number(st.from, s, c, "start", st.line);
  const to = yield* number(st.to, s, c, "end", st.line);
  const step = st.step ? yield* number(st.step, s, c, "step", st.line) : 1;
  if (step === 0) fail("the for loop's step can't be 0", st.line);
  for (let i = from; step > 0 ? i <= to : i >= to; i += step) {
    const r = yield* pass(st.body, s, c, [[st.v, i]]);
    if (r) return r === "stop" ? undefined : r;
  }
  return undefined;
}

/** for k, v in f, state, start: call f until it gives nil (pairs and ipairs hand back such an f) */
export function* forIn(st: Of<"forin">, s: Scope, c: Ctx): Gen<Signal> {
  const [f, state, start] = yield* evalList(st.exprs, s, c);
  let ctl = start;
  for (;;) {
    const vals = yield* callValue(f, [state, ctl], c, st.line, "the for loop's iterator");
    if (vals[0] === undefined) return undefined;
    ctl = vals[0];
    const r = yield* pass(
      st.body,
      s,
      c,
      st.names.map((n, i): [string, Value] => [n, vals[i]]),
    );
    if (r) return r === "stop" ? undefined : r;
  }
}
