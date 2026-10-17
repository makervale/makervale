/** Calling a function: a Lua closure runs its body in a fresh scope, a native one runs in JavaScript. */
import type { Block } from "./ast";
import { MAX_CALL_DEPTH, fail } from "./errors";
import type { Ctx, Gen, Value } from "./table";
import { Closure, LuaTable, Native, Scope, isFn } from "./table";
import { describe } from "./values";

/** loops and calls let the frame go once this much work is done; the runtime then resumes them next frame */
export const STEP_BUDGET = 4000;

/** what a block can end with besides running off its end */
export type Signal = undefined | "break" | "continue" | { ret: Value[] };

type RunBlock = (body: Block, scope: Scope, c: Ctx) => Gen<Signal>;
let runBlock: RunBlock | null = null;

/** the statement runner (exec.ts) plugs itself in here: calls run blocks, and blocks make calls */
export function bindRunner(f: RunBlock): void {
  runBlock = f;
}

const isGen = (r: Value[] | Gen<Value[]>): r is Gen<Value[]> => !Array.isArray(r);

/** `what` names the function in errors ("onTouch", "the field color") */
export function* callValue(fn: Value, args: Value[], c: Ctx, line: number, what = "this"): Gen<Value[]> {
  if (fn instanceof Native) {
    const r = fn.fn(args, c, line);
    return isGen(r) ? yield* r : r;
  }
  if (fn instanceof LuaTable && isFn(fn.meta?.get("__call"))) {
    return yield* callValue(fn.meta!.get("__call"), [fn, ...args], c, line, what);
  }
  if (!(fn instanceof Closure)) return fail(`${what} isn't a function (it is ${describe(fn)})`, line);
  return yield* callClosure(fn, args, c, line);
}

function* callClosure(fn: Closure, args: Value[], c: Ctx, line: number): Gen<Value[]> {
  if (c.depth >= MAX_CALL_DEPTH) fail("too many calls inside each other (a function calls itself for ever?)", line);
  const scope = new Scope(fn.scope);
  fn.f.params.forEach((p, i) => scope.vars.set(p, args[i]));
  if (fn.f.vararg) scope.varargs = args.slice(fn.f.params.length);
  const mark = c.stack.length;
  c.stack.push(scope);
  c.depth++;
  try {
    if (c.steps > STEP_BUDGET) yield { wait: 0 };
    const sig = yield* runBlock!(fn.f.body, scope, c);
    if (sig === "break" || sig === "continue") return fail(`"${sig}" can only be used inside a loop`, line);
    return sig ? sig.ret : [];
  } finally {
    c.depth--;
    c.stack.length = mark;
  }
}

/** `run` in a scope of its own, with these locals already set (a loop's variables) */
export function* scoped<T>(s: Scope, c: Ctx, locals: [string, Value][], run: (scope: Scope) => Gen<T>): Gen<T> {
  const scope = new Scope(s);
  for (const [k, v] of locals) scope.vars.set(k, v);
  const mark = c.stack.length;
  c.stack.push(scope);
  try {
    return yield* run(scope);
  } finally {
    c.stack.length = mark;
  }
}

export const runBody = (body: Block, scope: Scope, c: Ctx): Gen<Signal> => runBlock!(body, scope, c);

/** a block in a scope of its own */
export const inScope = (body: Block, s: Scope, c: Ctx, locals: [string, Value][] = []): Gen<Signal> =>
  scoped(s, c, locals, (scope) => runBody(body, scope, c));
