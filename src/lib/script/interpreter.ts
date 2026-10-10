/** Statements run as a generator: the runtime calls next() until the handler waits, acts, or ends.
 *  Loops yield a zero wait once the step budget is spent so one script cannot freeze a frame. */
import { ScriptError } from "./ast";
import type { ActStmt, Expr, Handler, Program, RepeatStmt, SetStmt, Stmt, Val, VarStmt, WhileStmt } from "./ast";
import { evalExpr } from "./eval";
import { STEP_BUDGET, tick } from "./runtime";
import type { Ctx, Yield } from "./runtime";
import { num, plus, show, truthy } from "./values";
import { clamp } from "@/lib/vec";

const MAX_VARS = 200;
const MAX_REPEAT = 100_000;
const MAX_WAIT_S = 3600;
const MAX_DURATION_S = 600;
/** actions whose every argument must be a number */
const NUMERIC_ACTIONS = new Set(["move", "turn", "grow", "pivot", "spin", "glow", "opacity", "timer", "push"]);

const STOP = Symbol("stop");
type Flow = typeof STOP | void;
type Run = Generator<Yield, Flow, void>;

function* run(body: Stmt[], c: Ctx): Run {
  for (const s of body) {
    tick(c, s.line);
    const r = yield* exec(s, c);
    if (r === STOP) return STOP;
  }
}

function* exec(s: Stmt, c: Ctx): Run {
  switch (s.k) {
    case "var":
    case "set":
      return assign(s, c);
    case "if":
      return yield* run(truthy(evalExpr(s.c, c)) ? s.a : (s.b ?? []), c);
    case "repeat":
      return yield* repeat(s, c);
    case "while":
      return yield* loop(s, c);
    case "wait":
      yield { k: "wait", s: clamp(num(evalExpr(s.e, c), s.line, "wait"), 0, MAX_WAIT_S) };
      return;
    case "stop":
      return STOP;
    case "act":
      yield action(s, c);
      return;
  }
}

function assign(s: VarStmt | SetStmt, c: Ctx): void {
  const v = assignedValue(s, c);
  if (s.k === "set" && !c.vars.has(s.n)) {
    throw new ScriptError(`"${s.n}" isn't declared (write "var ${s.n} = …" first)`, s.line);
  }
  if (!c.vars.has(s.n) && c.vars.size >= MAX_VARS) throw new ScriptError("too many variables", s.line);
  c.vars.set(s.n, typeof v === "number" && !isFinite(v) ? 0 : v);
}

function assignedValue(s: VarStmt | SetStmt, c: Ctx): Val {
  if (s.k === "var") return s.e ? evalExpr(s.e, c) : 0;
  const v = evalExpr(s.e, c);
  if (s.op === "=") return v;
  const old = c.vars.get(s.n);
  if (old === undefined) throw new ScriptError(`"${s.n}" has no value (declare it with var)`, s.line);
  if (s.op === "+=") return plus(old, v, s.line, "+=");
  return num(old, s.line, "-=") - num(v, s.line, "-=");
}

function* repeat(s: RepeatStmt, c: Ctx): Run {
  const n = clamp(Math.floor(num(evalExpr(s.n, c), s.line, "repeat")), 0, MAX_REPEAT);
  for (let i = 0; i < n; i++) {
    const r = yield* run(s.body, c);
    if (r === STOP) return STOP;
    if (c.steps > STEP_BUDGET) yield { k: "wait", s: 0 };
  }
}

function* loop(s: WhileStmt, c: Ctx): Run {
  while (truthy(evalExpr(s.c, c))) {
    const r = yield* run(s.body, c);
    if (r === STOP) return STOP;
    if (c.steps > STEP_BUDGET) yield { k: "wait", s: 0 };
  }
}

function action(s: ActStmt, c: Ctx): Yield {
  const a = s.a.map((x) => evalExpr(x, c));
  const dur = s.dur ? clamp(num(evalExpr(s.dur, c), s.line, "in"), 0, MAX_DURATION_S) : 0;
  if (NUMERIC_ACTIONS.has(s.n)) {
    a.forEach((v, i) => {
      a[i] = num(v, s.line, s.n);
    });
  }
  // the second value of color is the material slot
  if (s.n === "color" && a.length > 1) a[1] = num(a[1], s.line, "color");
  if (s.n === "play") a[0] = num(a[0], s.line, "play");
  if (s.n === "kick") a[1] = num(a[1], s.line, "kick");
  return { k: "act", n: s.n, a, dur, line: s.line };
}

/** a running handler; the runtime calls next() until it waits or ends */
export function startHandler(h: Handler, c: Ctx): Run {
  return run(h.body, c);
}

/** top-level `var`s run to completion at once; they have nothing to wait for */
export function initGlobals(p: Program, c: Ctx): void {
  const g = run(p.globals, c);
  for (let r = g.next(); !r.done; r = g.next()) {
    // globals don't wait
  }
}

/** an event's numeric argument (`on timer 2`, `on near 3`), or `fallback` when it is missing or not a number */
export function evalArg(e: Expr | null, c: Ctx, fallback: number): number {
  if (!e) return fallback;
  const v = evalExpr(e, c);
  return typeof v === "number" ? v : Number(v) || fallback;
}

/** an event's literal text argument (`on hear "word"`), or "" */
export function evalText(e: Expr | null): string {
  return e && e.k === "lit" ? show(e.v) : "";
}
