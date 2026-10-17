/** The basic functions: print, type, tostring, tonumber, pairs, ipairs, select, error, assert, pcall, metatables. */
import { callValue } from "./call";
import { LuaError, fail } from "./errors";
import { tostrMeta } from "./index-ops";
import { argInt, argTable } from "./std-args";
import type { Ctx, Gen, NativeFn, Value } from "./table";
import { LuaTable, Native } from "./table";
import { describe, tonum, typeName } from "./values";

function* print(a: Value[], c: Ctx, line: number): Gen<Value[]> {
  const parts: string[] = [];
  for (const v of a) parts.push(yield* tostrMeta(v, c, line));
  c.print(parts.join("\t"));
  return [];
}

function tonumber(a: Value[], _c: Ctx, line: number): Value[] {
  if (a[1] === undefined) return [tonum(a[0]) ?? undefined];
  const base = argInt(a, 1, "tonumber", line);
  if (base < 2 || base > 36) fail("tonumber's base must be between 2 and 36", line);
  const s = String(a[0]).trim().toLowerCase();
  const digits = "0123456789abcdefghijklmnopqrstuvwxyz".slice(0, base);
  if (!s || ![...s.replace(/^-/, "")].every((d) => digits.includes(d))) return [undefined];
  return [parseInt(s, base)];
}

/** the iterator pairs() hands out: it walks the table's keys in the order they were added */
function pairs(a: Value[], _c: Ctx, line: number): Value[] {
  const t = argTable(a, 0, "pairs", line);
  const it = t.entries();
  const next = (_: Value[], c: Ctx): Value[] => {
    c.steps++;
    const r = it.next();
    return r.done ? [undefined] : [r.value[0] as Value, r.value[1]];
  };
  return [new Native("pairs iterator", next), t, undefined];
}

function ipairs(a: Value[], _c: Ctx, line: number): Value[] {
  const t = argTable(a, 0, "ipairs", line);
  let i = 0;
  const next = (): Value[] => {
    const v = t.get(++i);
    return v === undefined ? [undefined] : [i, v];
  };
  return [new Native("ipairs iterator", next), t, 0];
}

/** next(t, k): the key after k (pairs() is the quick way to walk a table) */
function next(a: Value[], c: Ctx, line: number): Value[] {
  const t = argTable(a, 0, "next", line);
  const keys = t.keys();
  c.steps += keys.length;
  const i = a[1] === undefined ? 0 : keys.indexOf(a[1]) + 1;
  if (a[1] !== undefined && i === 0) fail("next was given a key that isn't in the table", line);
  return i < keys.length ? [keys[i] as Value, t.get(keys[i] as Value)] : [undefined];
}

function select(a: Value[], _c: Ctx, line: number): Value[] {
  if (a[0] === "#") return [a.length - 1];
  const n = argInt(a, 0, "select", line);
  return n < 0 ? a.slice(Math.max(1, a.length + n)) : a.slice(Math.max(1, n));
}

function error(a: Value[], _c: Ctx, line: number): Value[] {
  const v = a[0];
  throw new LuaError(typeof v === "string" ? v : `(an error with ${describe(v)})`, line, v);
}

function assert(a: Value[], _c: Ctx, line: number): Value[] {
  if (a[0] === undefined || a[0] === false) {
    throw new LuaError(typeof a[1] === "string" ? a[1] : "assertion failed!", line, a[1] ?? "assertion failed!");
  }
  return a;
}

/** pcall(f, …): true and f's results, or false and the error (a script that never waits can't be caught) */
function* pcall(a: Value[], c: Ctx, line: number): Gen<Value[]> {
  try {
    return [true, ...(yield* callValue(a[0], a.slice(1), c, line, "pcall's function"))];
  } catch (e) {
    if (!(e instanceof LuaError) || e.fatal) throw e;
    return [false, typeof e.value === "string" ? e.message : (e.value as Value)];
  }
}

function setmetatable(a: Value[], _c: Ctx, line: number): Value[] {
  const t = argTable(a, 0, "setmetatable", line);
  const m = a[1];
  if (m !== undefined && !(m instanceof LuaTable)) fail("setmetatable needs a table (or nil) as its metatable", line);
  t.meta = m instanceof LuaTable ? m : null;
  return [t];
}

export const BASE: Record<string, NativeFn> = {
  print,
  type: (a) => [typeName(a[0])],
  tostring: function* (a, c, line) {
    return [yield* tostrMeta(a[0], c, line)];
  },
  tonumber,
  pairs,
  ipairs,
  next,
  select,
  error,
  assert,
  pcall,
  setmetatable,
  getmetatable: (a) => [a[0] instanceof LuaTable ? (a[0].meta ?? undefined) : undefined],
  rawget: (a, _c, l) => [argTable(a, 0, "rawget", l).get(a[1])],
  rawset: (a, _c, l) => {
    argTable(a, 0, "rawset", l).set(a[1], a[2], l);
    return [a[0]];
  },
  rawequal: (a) => [a[0] === a[1]],
};
