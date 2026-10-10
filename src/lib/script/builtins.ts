/** The functions a script can call: random, round, floor, abs, min, max, sin, cos, text, len, contains. */
import type { Val } from "./ast";
import type { Ctx } from "./runtime";
import { cap, num, show } from "./values";

export type Builtin = (args: Val[], ctx: Ctx, line: number) => Val;

const MAX_ROUND_PLACES = 6;
const DEG_TO_RAD = Math.PI / 180;

function random(a: Val[], c: Ctx, l: number): Val {
  if (a.length < 2) return c.rand();
  const lo = num(a[0], l, "random");
  return lo + c.rand() * (num(a[1], l, "random") - lo);
}

function round(a: Val[], _c: Ctx, l: number): Val {
  const places = a.length > 1 ? Math.max(0, Math.min(MAX_ROUND_PLACES, Math.floor(num(a[1], l, "round")))) : 0;
  const k = 10 ** places;
  return Math.round(num(a[0], l, "round") * k) / k;
}

const BUILTINS: Record<string, Builtin> = {
  random,
  round,
  floor: (a, _c, l) => Math.floor(num(a[0], l, "floor")),
  abs: (a, _c, l) => Math.abs(num(a[0], l, "abs")),
  min: (a, _c, l) => Math.min(...a.map((x) => num(x, l, "min"))),
  max: (a, _c, l) => Math.max(...a.map((x) => num(x, l, "max"))),
  sin: (a, _c, l) => Math.sin(num(a[0], l, "sin") * DEG_TO_RAD),
  cos: (a, _c, l) => Math.cos(num(a[0], l, "cos") * DEG_TO_RAD),
  text: (a) => cap(show(a[0] ?? "")),
  len: (a) => show(a[0] ?? "").length,
  contains: (a) =>
    show(a[0] ?? "")
      .toLowerCase()
      .includes(show(a[1] ?? "").toLowerCase()),
};

/** own-property lookup, so names like "constructor" are not callable */
export function builtin(name: string): Builtin | undefined {
  return Object.hasOwn(BUILTINS, name) ? BUILTINS[name] : undefined;
}
