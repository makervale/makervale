/** The string library: what strings know (also as s:method()), with string.format and Luau's string.split. */
import { MAX_STRING, fail } from "./errors";
import { argInt, argNum, argText, list } from "./std-args";
import { find, gmatch, gsub, match } from "./std-pattern";
import type { Ctx, NativeFn, Value } from "./table";
import { LuaTable, Native } from "./table";
import { tostr } from "./values";

/** Lua's 1-based, negative-from-the-end position as a 0-based index into a string of length n */
export function position(i: number, n: number): number {
  if (i > 0) return i - 1;
  if (i < 0) return Math.max(0, n + i);
  return 0;
}

const capped = (s: string, line: number): string => (s.length > MAX_STRING ? fail("this text is too long", line) : s);

function sub(a: Value[], _c: Ctx, line: number): Value[] {
  const s = argText(a, 0, "string.sub", line);
  const i = position(argInt(a, 1, "string.sub", line, 1), s.length);
  const jRaw = argInt(a, 2, "string.sub", line, -1);
  const j = jRaw < 0 ? s.length + jRaw + 1 : Math.min(jRaw, s.length);
  return [s.slice(i, Math.max(i, j))];
}

function rep(a: Value[], c: Ctx, line: number): Value[] {
  const s = argText(a, 0, "string.rep", line);
  const n = Math.max(0, argInt(a, 1, "string.rep", line));
  const sep = argText(a, 2, "string.rep", line, "");
  if ((s.length + sep.length) * n > MAX_STRING) fail("this text is too long", line);
  c.steps += n;
  return [Array(n).fill(s).join(sep)];
}

function byte(a: Value[], _c: Ctx, line: number): Value[] {
  const s = argText(a, 0, "string.byte", line);
  const i = argInt(a, 1, "string.byte", line, 1);
  const j = argInt(a, 2, "string.byte", line, i);
  const out: Value[] = [];
  for (let k = position(i, s.length); k < Math.min(s.length, j < 0 ? s.length + j + 1 : j); k++)
    out.push(s.charCodeAt(k));
  return out;
}

function split(a: Value[], c: Ctx, line: number): Value[] {
  const s = argText(a, 0, "string.split", line);
  const sep = argText(a, 1, "string.split", line, ",");
  const parts = sep === "" ? [...s] : s.split(sep);
  c.steps += parts.length;
  return [list(parts)];
}

const FORMAT = /%([-+ #0]*)(\d*)(?:\.(\d+))?([diouxXeEfgGqsc%])/g;

function pad(s: string, flags: string, width: number): string {
  if (s.length >= width) return s;
  if (flags.includes("-")) return s.padEnd(width);
  if (flags.includes("0") && /^[+-]?[0-9.]/.test(s)) {
    const sign = /^[+-]/.test(s) ? s[0] : "";
    return sign + s.slice(sign.length).padStart(width - sign.length, "0");
  }
  return s.padStart(width);
}

type Conv = (n: () => number, v: Value, p: number | undefined) => string;

const CONVERSIONS: Record<string, Conv> = {
  d: (n) => String(Math.trunc(n())),
  f: (n, _v, p) => n().toFixed(p ?? 6),
  e: (n, _v, p) => n().toExponential(p ?? 6),
  g: (n, _v, p) => tostr(Number(n().toPrecision(p || 6))),
  x: (n) => Math.trunc(n()).toString(16),
  o: (n) => Math.trunc(n()).toString(8),
  u: (n) => String(Math.abs(Math.trunc(n()))),
  c: (n) => String.fromCharCode(n()),
  q: (_n, v) => JSON.stringify(tostr(v)),
  s: (_n, v, p) => (p === undefined ? tostr(v) : tostr(v).slice(0, p)),
};

function formatOne(conv: string, v: Value, prec: string | undefined, flags: string, line: number): string {
  const n = () => argNum([v], 0, "string.format", line);
  const f = CONVERSIONS[conv.toLowerCase() === "i" ? "d" : conv.toLowerCase()];
  const s = f(n, v, prec === undefined ? undefined : Number(prec));
  const upper = conv === "X" || conv === "E" || conv === "G" ? s.toUpperCase() : s;
  const numeric = "dieEfgG".includes(conv);
  return numeric && flags.includes("+") && !upper.startsWith("-") ? "+" + upper : upper;
}

function format(a: Value[], _c: Ctx, line: number): Value[] {
  const fmt = argText(a, 0, "string.format", line);
  let next = 1;
  const out = fmt.replace(FORMAT, (_m, flags: string, width: string, prec: string | undefined, conv: string) => {
    if (conv === "%") return "%";
    if (next >= a.length) fail(`string.format is missing a value for argument ${next + 1}`, line);
    return pad(formatOne(conv, a[next++], prec, flags, line), flags, Number(width || 0));
  });
  return [capped(out, line)];
}

const fns: Record<string, NativeFn> = {
  len: (a, _c, l) => [argText(a, 0, "string.len", l).length],
  sub,
  upper: (a, _c, l) => [argText(a, 0, "string.upper", l).toUpperCase()],
  lower: (a, _c, l) => [argText(a, 0, "string.lower", l).toLowerCase()],
  rep,
  reverse: (a, _c, l) => [[...argText(a, 0, "string.reverse", l)].reverse().join("")],
  byte,
  char: (a, _c, l) => [capped(a.map((_, i) => String.fromCharCode(argInt(a, i, "string.char", l))).join(""), l)],
  format,
  split,
  find,
  match,
  gmatch,
  gsub,
};

export function stringLib(): LuaTable {
  const t = new LuaTable();
  for (const [name, fn] of Object.entries(fns)) t.set(name, new Native("string." + name, fn));
  return t;
}
