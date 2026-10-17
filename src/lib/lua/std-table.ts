/** The table library, with Luau's table.find and table.clear. */
import { callValue } from "./call";
import { MAX_STRING, fail } from "./errors";
import { argInt, argTable, argText } from "./std-args";
import type { Ctx, Gen, NativeFn, Value } from "./table";
import { LuaTable, Native } from "./table";
import { less, tostr, truthy } from "./values";

function insert(a: Value[], c: Ctx, line: number): Value[] {
  const t = argTable(a, 0, "table.insert", line);
  const n = t.length;
  if (a.length < 3) {
    t.set(n + 1, a[1], line);
    return [];
  }
  const pos = argInt(a, 1, "table.insert", line);
  if (pos < 1 || pos > n + 1) fail("table.insert's position is out of range", line);
  for (let i = n; i >= pos; i--) t.set(i + 1, t.get(i), line);
  t.set(pos, a[2], line);
  c.steps += n - pos + 1;
  return [];
}

function remove(a: Value[], c: Ctx, line: number): Value[] {
  const t = argTable(a, 0, "table.remove", line);
  const n = t.length;
  const pos = argInt(a, 1, "table.remove", line, n);
  if (n === 0 && a[1] === undefined) return [undefined];
  if (pos < 1 || pos > n + 1) fail("table.remove's position is out of range", line);
  const v = t.get(pos);
  for (let i = pos; i < n; i++) t.set(i, t.get(i + 1), line);
  if (pos <= n) t.set(n, undefined, line);
  c.steps += n - pos + 1;
  return [v];
}

function concat(a: Value[], c: Ctx, line: number): Value[] {
  const t = argTable(a, 0, "table.concat", line);
  const sep = argText(a, 1, "table.concat", line, "");
  const i = argInt(a, 2, "table.concat", line, 1);
  const j = argInt(a, 3, "table.concat", line, t.length);
  const parts: string[] = [];
  for (let k = i; k <= j; k++) {
    const v = t.get(k);
    if (typeof v !== "string" && typeof v !== "number")
      fail(`table.concat found ${typeof v} at ${k}: only text and numbers join`, line);
    parts.push(tostr(v));
  }
  c.steps += parts.length;
  const s = parts.join(sep);
  return s.length > MAX_STRING ? fail("this text is too long", line) : [s];
}

/** a stable merge sort that can call a Lua comparison (which may wait) */
function* mergeSort(xs: Value[], lt: (x: Value, y: Value) => Gen<boolean>): Gen<Value[]> {
  if (xs.length <= 1) return xs;
  const mid = xs.length >> 1;
  const l = yield* mergeSort(xs.slice(0, mid), lt);
  const r = yield* mergeSort(xs.slice(mid), lt);
  const out: Value[] = [];
  let [i, j] = [0, 0];
  while (i < l.length && j < r.length) out.push((yield* lt(r[j], l[i])) ? r[j++] : l[i++]);
  return out.concat(l.slice(i), r.slice(j));
}

function* sort(a: Value[], c: Ctx, line: number): Gen<Value[]> {
  const t = argTable(a, 0, "table.sort", line);
  const cmp = a[1];
  const xs = Array.from({ length: t.length }, (_, i) => t.get(i + 1));
  c.steps += xs.length * Math.ceil(Math.log2(xs.length + 1));
  const lt = function* (x: Value, y: Value): Gen<boolean> {
    if (cmp === undefined) return less(x, y, false, line);
    return truthy((yield* callValue(cmp, [x, y], c, line, "table.sort's comparison"))[0]);
  };
  (yield* mergeSort(xs, lt)).forEach((v, i) => t.set(i + 1, v, line));
  return [];
}

export function unpack(a: Value[], c: Ctx, line: number): Value[] {
  const t = argTable(a, 0, "table.unpack", line);
  const i = argInt(a, 1, "table.unpack", line, 1);
  const j = argInt(a, 2, "table.unpack", line, t.length);
  if (j - i > 10_000) fail("table.unpack: too many values", line);
  c.steps += Math.max(0, j - i + 1);
  return Array.from({ length: Math.max(0, j - i + 1) }, (_, k) => t.get(i + k));
}

function find(a: Value[], c: Ctx, line: number): Value[] {
  const t = argTable(a, 0, "table.find", line);
  for (let k = argInt(a, 2, "table.find", line, 1); k <= t.length; k++) {
    c.steps++;
    if (t.get(k) === a[1]) return [k];
  }
  return [undefined];
}

const FNS: Record<string, NativeFn> = {
  insert,
  remove,
  concat,
  sort,
  unpack,
  find,
  clear: (a, _c, l) => {
    argTable(a, 0, "table.clear", l).clear();
    return [];
  },
};

export function tableLib(): LuaTable {
  const t = new LuaTable();
  for (const [name, fn] of Object.entries(FNS)) t.set(name, new Native("table." + name, fn));
  return t;
}
