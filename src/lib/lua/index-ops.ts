/** Reading and writing t[k], with what a metatable adds: __index, __newindex and __tostring. */
import { callValue } from "./call";
import { fail } from "./errors";
import type { Ctx, Gen, Value } from "./table";
import { LuaTable, isFn } from "./table";
import { describe, tostr } from "./values";

/** how far __index may lead from one table to the next */
const MAX_CHAIN = 50;

const keyText = (k: Value): string => (typeof k === "string" ? `"${k}"` : tostr(k));

export function* index(o: Value, key: Value, c: Ctx, line: number, what = "this"): Gen<Value> {
  for (let hops = 0; hops < MAX_CHAIN; hops++) {
    if (typeof o === "string") return yield* index(c.globals.get("string"), key, c, line);
    if (!(o instanceof LuaTable)) return fail(`can't read ${keyText(key)} from ${what}: it is ${describe(o)}`, line);
    const v = o.get(key);
    const h = v === undefined ? o.meta?.get("__index") : undefined;
    if (h === undefined) return v;
    if (isFn(h)) return (yield* callValue(h, [o, key], c, line, "__index"))[0];
    o = h;
  }
  return fail("__index leads round in a circle", line);
}

/** where an assignment is: its line, and how what it assigns into is named */
export interface At {
  line: number;
  what: string;
}

export function* setIndex(o: Value, key: Value, v: Value, c: Ctx, { line, what }: At): Gen<void> {
  for (let hops = 0; hops < MAX_CHAIN; hops++) {
    if (!(o instanceof LuaTable)) return fail(`can't set ${keyText(key)} on ${what}: it is ${describe(o)}`, line);
    const h = o.get(key) === undefined ? o.meta?.get("__newindex") : undefined;
    if (h === undefined) return o.set(key, v, line);
    if (isFn(h)) return void (yield* callValue(h, [o, key, v], c, line, "__newindex"));
    o = h;
  }
  fail("__newindex leads round in a circle", line);
}

/** tostring(), honouring __tostring */
export function* tostrMeta(v: Value, c: Ctx, line: number): Gen<string> {
  const h = v instanceof LuaTable ? v.meta?.get("__tostring") : undefined;
  if (h === undefined) return tostr(v);
  const r = (yield* callValue(h, [v], c, line, "__tostring"))[0];
  return typeof r === "string" ? r : fail("__tostring must give text", line);
}
