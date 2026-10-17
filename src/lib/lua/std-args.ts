/** Reading a native function's arguments, with errors that name the function and the argument. */
import { fail } from "./errors";
import type { Value } from "./table";
import { LuaTable } from "./table";
import { describe, tonum, tostr } from "./values";

export function argText(args: Value[], i: number, fn: string, line: number, dflt?: string): string {
  const v = args[i];
  if (v === undefined && dflt !== undefined) return dflt;
  if (typeof v === "string") return v;
  if (typeof v === "number") return tostr(v);
  return fail(`${fn} needs text as argument ${i + 1}, not ${describe(v)}`, line);
}

export function argNum(args: Value[], i: number, fn: string, line: number, dflt?: number): number {
  const v = args[i];
  if (v === undefined && dflt !== undefined) return dflt;
  const n = tonum(v);
  return n === null ? fail(`${fn} needs a number as argument ${i + 1}, not ${describe(v)}`, line) : n;
}

export const argInt = (args: Value[], i: number, fn: string, line: number, dflt?: number): number =>
  Math.trunc(argNum(args, i, fn, line, dflt));

export function argTable(args: Value[], i: number, fn: string, line: number): LuaTable {
  const v = args[i];
  return v instanceof LuaTable ? v : fail(`${fn} needs a table as argument ${i + 1}, not ${describe(v)}`, line);
}

/** a table holding these values at 1, 2, 3 … */
export function list(values: Value[]): LuaTable {
  const t = new LuaTable();
  values.forEach((v, i) => t.set(i + 1, v));
  return t;
}
