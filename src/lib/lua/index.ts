/**
 * Lua for scripts: Lua 5.1 as Roblox has it (Luau's +=, continue and `text {with} values`), run by our own
 * interpreter so every step is counted and any function can wait. No coroutines (wait() does their job), no goto,
 * no io or os: a script reaches nothing but what its host hands it.
 *
 * Each running piece of Lua is a generator: it yields { wait: seconds } and the host resumes it later.
 */
import type { Block } from "./ast";
import { callValue } from "./call";
import { execBlock } from "./exec";
import { fail } from "./errors";
import { BASE } from "./std-base";
import { mathLib } from "./std-math";
import { stringLib } from "./std-string";
import { tableLib, unpack } from "./std-table";
import type { Ctx, Gen, Value } from "./table";
import { LuaTable, Native, Scope } from "./table";

export type { Block } from "./ast";
export { parse } from "./parser";
export { LuaError, MAX_SOURCE } from "./errors";
export { STEP_BUDGET } from "./call";
export { Closure, LuaTable, Native, Scope, isFn } from "./table";
export type { Ctx, Gen, NativeFn, Value, Wait } from "./table";
export { tostr, truthy, typeName } from "./values";
export { fromPlain, toPlain } from "./plain";
export type { Plain } from "./plain";
export { measure } from "./memory";
export { argInt, argNum, argTable, argText, list } from "./std-args";

/** a fresh global table with the standard library */
export function newGlobals(): LuaTable {
  const g = new LuaTable();
  for (const [name, fn] of Object.entries(BASE)) g.set(name, new Native(name, fn));
  g.set("unpack", new Native("unpack", unpack));
  g.set("math", mathLib());
  g.set("string", stringLib());
  g.set("table", tableLib());
  g.set("_G", g);
  g.set("_VERSION", "Lua 5.1");
  return g;
}

/** a thread's own bookkeeping, sharing the script's globals and output */
export function newCtx(globals: LuaTable, print: (text: string) => void, random: () => number): Ctx {
  return { steps: 0, globals, stack: [], depth: 0, print, random };
}

/** run the script's top level; what it defines stays in its globals and in the scope its functions keep */
export function* runChunk(body: Block, c: Ctx): Gen<Value[]> {
  const scope = new Scope(null);
  c.stack.push(scope);
  const sig = yield* execBlock(body, scope, c);
  if (sig === "break" || sig === "continue") return fail(`"${sig}" can only be used inside a loop`, 0);
  return sig ? sig.ret : [];
}

/** call a Lua value (an event handler, a timer's function) as a thread of its own */
export const callFunction = (fn: Value, args: Value[], c: Ctx, what: string): Gen<Value[]> =>
  callValue(fn, args, c, 0, what);
