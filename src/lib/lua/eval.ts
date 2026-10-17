/** Evaluating expressions. Each one may call a function that waits, so each is a generator; each counts a step. */
import type { CallExpr, Expr, TableItem } from "./ast";
import { callValue } from "./call";
import { fail } from "./errors";
import { index } from "./index-ops";
import type { Ctx, Gen, Scope, Value } from "./table";
import { Closure, LuaTable } from "./table";
import { binary, length, tonum, tostr, truthy } from "./values";

type Of<K extends Expr["k"]> = Extract<Expr, { k: K }>;
type Evaluator = (e: never, s: Scope, c: Ctx) => Gen<Value>;

export function lookup(name: string, s: Scope, c: Ctx): Value {
  const owner = s.find(name);
  return owner ? owner.vars.get(name) : c.globals.get(name);
}

/** how an expression is named in an error: "onTouch", "the field color", "this" */
export function nameOf(e: Expr): string {
  if (e.k === "name") return `"${e.n}"`;
  if (e.k === "index" && e.key.k === "str") return `the field "${e.key.v}"`;
  if (e.k === "method") return `the method "${e.name}"`;
  return "this";
}

/** expressions that never call anything */
const QUICK: Partial<Record<Expr["k"], (e: never, s: Scope, c: Ctx) => Value>> = {
  nil: () => undefined,
  bool: (e: Of<"bool">) => e.v,
  num: (e: Of<"num">) => e.v,
  str: (e: Of<"str">) => e.v,
  name: (e: Of<"name">, s, c) => lookup(e.n, s, c),
  fn: (e: Of<"fn">, s) => new Closure(e.f, s),
  vararg: (e: Of<"vararg">, s) => varargsOf(s, e.line)[0],
};

const EVAL: Partial<Record<Expr["k"], Evaluator>> = {
  *index(e: Of<"index">, s, c) {
    const o = yield* evalExpr(e.o, s, c);
    return yield* index(o, yield* evalExpr(e.key, s, c), c, e.line, nameOf(e.o));
  },
  *call(e: Of<"call">, s, c) {
    return (yield* evalCall(e, s, c))[0];
  },
  *method(e: Of<"method">, s, c) {
    return (yield* evalCall(e, s, c))[0];
  },
  bin: evalBin,
  *un(e: Of<"un">, s, c) {
    const v = yield* evalExpr(e.e, s, c);
    if (e.op === "not") return !truthy(v);
    if (e.op === "#") return length(v, e.line);
    const n = tonum(v);
    return n === null ? fail(`can't make ${tostr(v)} negative`, e.line) : -n;
  },
  table: evalTable,
  *interp(e: Of<"interp">, s, c) {
    let out = "";
    for (const part of e.parts) out += typeof part === "string" ? part : tostr(yield* evalExpr(part, s, c));
    return out;
  },
  *paren(e: Of<"paren">, s, c) {
    return yield* evalExpr(e.e, s, c);
  },
};

export function* evalExpr(e: Expr, s: Scope, c: Ctx): Gen<Value> {
  c.steps++;
  const quick = QUICK[e.k];
  return quick ? quick(e as never, s, c) : yield* EVAL[e.k]!(e as never, s, c);
}

function varargsOf(s: Scope, line: number): Value[] {
  for (let x: Scope | null = s; x; x = x.parent) if (x.varargs) return x.varargs;
  return fail('"..." can only be used inside a function(...)', line);
}

function* evalBin(e: Of<"bin">, s: Scope, c: Ctx): Gen<Value> {
  const a = yield* evalExpr(e.a, s, c);
  // and/or only look at their right side when they need it
  if (e.op === "and") return truthy(a) ? yield* evalExpr(e.b, s, c) : a;
  if (e.op === "or") return truthy(a) ? a : yield* evalExpr(e.b, s, c);
  return binary(e.op, a, yield* evalExpr(e.b, s, c), e.line);
}

/** all the values an expression gives: a call or "..." can give several, anything else one */
export function* evalMulti(e: Expr, s: Scope, c: Ctx): Gen<Value[]> {
  if (e.k === "call" || e.k === "method") return yield* evalCall(e, s, c);
  if (e.k === "vararg") return [...varargsOf(s, e.line)];
  return [yield* evalExpr(e, s, c)];
}

/** a list of expressions: each gives one value, except the last, which gives all of its */
export function* evalList(es: Expr[], s: Scope, c: Ctx): Gen<Value[]> {
  const out: Value[] = [];
  for (let i = 0; i < es.length - 1; i++) out.push(yield* evalExpr(es[i], s, c));
  if (es.length) out.push(...(yield* evalMulti(es[es.length - 1], s, c)));
  return out;
}

export function* evalCall(e: CallExpr, s: Scope, c: Ctx): Gen<Value[]> {
  c.steps++;
  if (e.k === "call") {
    const fn = yield* evalExpr(e.f, s, c);
    return yield* callValue(fn, yield* evalList(e.args, s, c), c, e.line, nameOf(e.f));
  }
  const o = yield* evalExpr(e.o, s, c);
  const fn = yield* index(o, e.name, c, e.line, nameOf(e.o));
  return yield* callValue(fn, [o, ...(yield* evalList(e.args, s, c))], c, e.line, nameOf(e));
}

function* evalTable(e: Of<"table">, s: Scope, c: Ctx): Gen<Value> {
  const t = new LuaTable();
  let n = 0;
  for (let i = 0; i < e.items.length; i++) {
    const item: TableItem = e.items[i];
    if (item.k === "named") t.set(item.key, yield* evalExpr(item.v, s, c), e.line);
    else if (item.k === "keyed") t.set(yield* evalExpr(item.key, s, c), yield* evalExpr(item.v, s, c), e.line);
    else if (i === e.items.length - 1) for (const v of yield* evalMulti(item.v, s, c)) t.set(++n, v, e.line);
    else t.set(++n, yield* evalExpr(item.v, s, c), e.line);
  }
  c.steps += e.items.length;
  return t;
}
