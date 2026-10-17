/** The math library, with Luau's math.clamp, math.round and math.sign. Angles are in radians, as in Lua. */
import { fail } from "./errors";
import { argInt, argNum } from "./std-args";
import type { Ctx, NativeFn, Value } from "./table";
import { LuaTable, Native } from "./table";

const one =
  (name: string, f: (x: number) => number): NativeFn =>
  (a, _c, l) => [f(argNum(a, 0, "math." + name, l))];

/** math.random(): 0 ≤ x < 1; random(m): a whole number 1…m; random(m, n): m…n */
function random(a: Value[], c: Ctx, line: number): Value[] {
  const r = c.random();
  if (a.length === 0) return [r];
  const lo = a.length > 1 ? argInt(a, 0, "math.random", line) : 1;
  const hi = argInt(a, a.length > 1 ? 1 : 0, "math.random", line);
  if (lo > hi) fail("math.random's range is empty", line);
  return [lo + Math.floor(r * (hi - lo + 1))];
}

function minmax(name: string, pick: (a: number, b: number) => number): NativeFn {
  return (a, _c, l) => {
    if (!a.length) fail(`math.${name} needs at least one number`, l);
    return [a.map((_, i) => argNum(a, i, "math." + name, l)).reduce(pick)];
  };
}

const FNS: Record<string, NativeFn> = {
  abs: one("abs", Math.abs),
  ceil: one("ceil", Math.ceil),
  floor: one("floor", Math.floor),
  sqrt: one("sqrt", Math.sqrt),
  sin: one("sin", Math.sin),
  cos: one("cos", Math.cos),
  tan: one("tan", Math.tan),
  asin: one("asin", Math.asin),
  acos: one("acos", Math.acos),
  exp: one("exp", Math.exp),
  rad: one("rad", (x) => (x * Math.PI) / 180),
  deg: one("deg", (x) => (x * 180) / Math.PI),
  round: one("round", (x) => Math.sign(x) * Math.round(Math.abs(x))),
  sign: one("sign", Math.sign),
  atan: (a, _c, l) => [Math.atan2(argNum(a, 0, "math.atan", l), argNum(a, 1, "math.atan", l, 1))],
  log: (a, _c, l) => {
    const x = Math.log(argNum(a, 0, "math.log", l));
    return [a[1] === undefined ? x : x / Math.log(argNum(a, 1, "math.log", l))];
  },
  fmod: (a, _c, l) => [argNum(a, 0, "math.fmod", l) % argNum(a, 1, "math.fmod", l)],
  modf: (a, _c, l) => {
    const x = argNum(a, 0, "math.modf", l);
    return [Math.trunc(x), x - Math.trunc(x)];
  },
  clamp: (a, _c, l) => {
    const [x, lo, hi] = [0, 1, 2].map((i) => argNum(a, i, "math.clamp", l));
    return [Math.min(Math.max(x, lo), hi)];
  },
  max: minmax("max", Math.max),
  min: minmax("min", Math.min),
  random,
  randomseed: () => [],
};

export function mathLib(): LuaTable {
  const t = new LuaTable();
  for (const [name, fn] of Object.entries(FNS)) t.set(name, new Native("math." + name, fn));
  t.set("pi", Math.PI);
  t.set("huge", Infinity);
  t.set("maxinteger", Number.MAX_SAFE_INTEGER);
  t.set("mininteger", Number.MIN_SAFE_INTEGER);
  return t;
}
