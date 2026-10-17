/** string.find, match, gmatch and gsub, on top of the pattern matcher. */
import { callValue } from "./call";
import { MAX_STRING, fail } from "./errors";
import { index } from "./index-ops";
import { Matcher } from "./pattern";
import { argInt, argText } from "./std-args";
import type { Ctx, Gen, Value } from "./table";
import { LuaTable, Native, isFn } from "./table";
import { describe, tostr, truthy } from "./values";

interface Found {
  m: Matcher;
  start: number;
  end: number;
}

/** 1-based init as Lua takes it, to a 0-based start */
function startAt(a: Value[], s: string, fn: string, line: number): number {
  const i = argInt(a, 2, fn, line, 1);
  if (i > 0) return i - 1;
  return i < 0 ? Math.max(0, s.length + i) : 0;
}

/** the first match of pat in s at or after `from` */
function search(s: string, pat: string, from: number, line: number): Found | null {
  const m = new Matcher(s, pat, line);
  const anchored = pat.startsWith("^");
  for (let i = from; i <= s.length; i++) {
    m.level = 0;
    const end = m.match(i, anchored ? 1 : 0);
    if (end !== -1) return { m, start: i, end };
    if (anchored) break;
  }
  return null;
}

export function find(a: Value[], c: Ctx, line: number): Value[] {
  const s = argText(a, 0, "string.find", line);
  const pat = argText(a, 1, "string.find", line);
  const from = startAt(a, s, "string.find", line);
  if (from > s.length) return [undefined];
  c.steps += s.length;
  if (truthy(a[3]) || !/[\^$*+?.()[\]%-]/.test(pat)) {
    const at = s.indexOf(pat, from);
    return at < 0 ? [undefined] : [at + 1, at + pat.length];
  }
  const f = search(s, pat, from, line);
  return f ? [f.start + 1, f.end, ...f.m.captures(f.start, f.end, false)] : [undefined];
}

export function match(a: Value[], c: Ctx, line: number): Value[] {
  const s = argText(a, 0, "string.match", line);
  const pat = argText(a, 1, "string.match", line);
  c.steps += s.length;
  const f = search(s, pat, startAt(a, s, "string.match", line), line);
  return f ? f.m.captures(f.start, f.end, true) : [undefined];
}

export function gmatch(a: Value[], _c: Ctx, line: number): Value[] {
  const s = argText(a, 0, "string.gmatch", line);
  const pat = argText(a, 1, "string.gmatch", line);
  let at = 0;
  const next = (_: Value[], c: Ctx): Value[] => {
    if (at > s.length) return [undefined];
    c.steps += s.length - at;
    const f = search(s, pat, at, line);
    if (!f) {
      at = s.length + 1;
      return [undefined];
    }
    // an empty match moves on one character, so the loop always ends
    at = f.end > f.start ? f.end : f.end + 1;
    return f.m.captures(f.start, f.end, true);
  };
  return [new Native("gmatch iterator", next)];
}

/** "%1 and %0" in a gsub replacement */
function expand(repl: string, f: Found, line: number): string {
  return repl.replace(/%(.)/g, (_m, ch: string) => {
    if (ch === "%") return "%";
    if (!/[0-9]/.test(ch)) return fail('a "%" in a gsub replacement must be followed by a digit or "%"', line);
    return tostr(ch === "0" ? f.m.src.slice(f.start, f.end) : f.m.capture(Number(ch) - 1, f.start, f.end));
  });
}

function* replacement(repl: Value, f: Found, c: Ctx, line: number): Gen<string> {
  const whole = f.m.src.slice(f.start, f.end);
  if (typeof repl === "string" || typeof repl === "number") return expand(tostr(repl), f, line);
  const first = f.m.captures(f.start, f.end, true);
  let v: Value;
  if (repl instanceof LuaTable) v = yield* index(repl, first[0], c, line);
  else if (isFn(repl)) v = (yield* callValue(repl, first, c, line, "gsub's function"))[0];
  else return fail(`gsub needs text, a table or a function as its replacement, not ${describe(repl)}`, line);
  if (v === undefined || v === false) return whole;
  if (typeof v !== "string" && typeof v !== "number") return fail("gsub's replacement must give text", line);
  return tostr(v);
}

export function* gsub(a: Value[], c: Ctx, line: number): Gen<Value[]> {
  const s = argText(a, 0, "string.gsub", line);
  const pat = argText(a, 1, "string.gsub", line);
  const max = a[3] === undefined ? Infinity : argInt(a, 3, "string.gsub", line);
  let out = "";
  let at = 0;
  let count = 0;
  while (count < max && at <= s.length) {
    const f = search(s, pat, at, line);
    if (!f) break;
    out += s.slice(at, f.start) + (yield* replacement(a[2], f, c, line));
    count++;
    at = f.end > f.start ? f.end : f.end + 1;
    if (f.end === f.start && f.start < s.length) out += s[f.start];
    if (out.length > MAX_STRING) fail("this text is too long", line);
    c.steps += 10;
    if (pat.startsWith("^")) break;
  }
  return [out + s.slice(Math.min(at, s.length)), count];
}
