/** Expression evaluation. Every operator and call counts as a step so busy scripts get stopped. */
import { ScriptError } from "./ast";
import type { Expr, Val } from "./ast";
import { builtin } from "./builtins";
import { tick } from "./runtime";
import type { Ctx } from "./runtime";
import { equal, num, plus, truthy } from "./values";

type BinExpr = Extract<Expr, { k: "bin" }>;
type CallExpr = Extract<Expr, { k: "call" }>;
type VarExpr = Extract<Expr, { k: "var" }>;

const MAX_CALL_ARGS = 8;
const TIME_PRECISION = 1000;

export function evalExpr(e: Expr, c: Ctx): Val {
  switch (e.k) {
    case "lit":
      return e.v;
    case "var":
      return lookup(e, c);
    case "un":
      return e.op === "not" ? !truthy(evalExpr(e.e, c)) : -num(evalExpr(e.e, c), 0, "-");
    case "call":
      return call(e, c);
    case "bin":
      return binary(e, c);
  }
}

function lookup(e: VarExpr, c: Ctx): Val {
  if (e.n in c.local) return c.local[e.n];
  if (e.n === "time") return Math.round(c.time() * TIME_PRECISION) / TIME_PRECISION;
  const v = c.vars.get(e.n);
  if (v === undefined) throw new ScriptError(`"${e.n}" has no value (declare it with var)`, e.line);
  return v;
}

function call(e: CallExpr, c: Ctx): Val {
  tick(c, e.line);
  const f = builtin(e.n);
  if (!f) throw new ScriptError(`there is no "${e.n}(…)"`, e.line);
  if (e.a.length > MAX_CALL_ARGS) throw new ScriptError("too many values", e.line);
  return f(
    e.a.map((x) => evalExpr(x, c)),
    c,
    e.line,
  );
}

function binary(e: BinExpr, c: Ctx): Val {
  tick(c, e.line);
  // and/or short-circuit, so their right side is evaluated only when needed
  if (e.op === "and") return truthy(evalExpr(e.a, c)) && truthy(evalExpr(e.b, c));
  if (e.op === "or") return truthy(evalExpr(e.a, c)) || truthy(evalExpr(e.b, c));
  const op = OPERATORS[e.op];
  if (!op) throw new ScriptError("cannot work this out", 0);
  return op(evalExpr(e.a, c), evalExpr(e.b, c), e.line);
}

type Operator = (a: Val, b: Val, line: number) => Val;

function divisor(b: Val, line: number, what: string): number {
  const d = num(b, line, what);
  if (d === 0) throw new ScriptError("division by zero", line);
  return d;
}

const bothText = (a: Val, b: Val): boolean => typeof a === "string" && typeof b === "string";

const OPERATORS: Record<string, Operator> = {
  "+": (a, b, l) => plus(a, b, l, "+"),
  "-": (a, b, l) => num(a, l, "-") - num(b, l, "-"),
  "*": (a, b, l) => num(a, l, "*") * num(b, l, "*"),
  "/": (a, b, l) => {
    const d = divisor(b, l, "/");
    return num(a, l, "/") / d;
  },
  "%": (a, b, l) => {
    const d = divisor(b, l, "%");
    return ((num(a, l, "%") % d) + d) % d;
  },
  "==": (a, b) => equal(a, b),
  "!=": (a, b) => !equal(a, b),
  "<": (a, b, l) => (bothText(a, b) ? a < b : num(a, l, "<") < num(b, l, "<")),
  ">": (a, b, l) => (bothText(a, b) ? a > b : num(a, l, ">") > num(b, l, ">")),
  "<=": (a, b, l) => num(a, l, "<=") <= num(b, l, "<="),
  ">=": (a, b, l) => num(a, l, ">=") >= num(b, l, ">="),
};
