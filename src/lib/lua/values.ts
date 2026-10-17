/** How values behave: their type names, printing, numbers from text, arithmetic, comparison and joining text. */
import type { BinOp } from "./ast";
import { MAX_STRING, fail } from "./errors";
import type { Value } from "./table";
import { Closure, LuaTable, Native } from "./table";

export function typeName(v: Value): string {
  if (v === undefined) return "nil";
  if (v instanceof LuaTable) return "table";
  if (v instanceof Closure || v instanceof Native) return "function";
  return typeof v;
}

export const truthy = (v: Value): boolean => v !== undefined && v !== false;

/** like Lua's %.14g: whole numbers without a decimal point */
export function numText(x: number): string {
  if (Number.isNaN(x)) return "nan";
  if (!Number.isFinite(x)) return x > 0 ? "inf" : "-inf";
  if (Number.isInteger(x) && Math.abs(x) < 1e15) return String(x === 0 ? 0 : x);
  const s = x.toPrecision(14);
  return s.includes("e") ? s.replace(/\.?0+e/, "e") : s.replace(/\.?0+$/, "");
}

export function tostr(v: Value): string {
  if (typeof v === "string") return v;
  if (typeof v === "number") return numText(v);
  if (v instanceof LuaTable) return `table: ${v.id}`;
  if (v instanceof Closure) return `function: ${v.f.name}`;
  if (v instanceof Native) return `function: ${v.name}`;
  return String(v ?? "nil");
}

/** a number, or a string that reads as one (as Lua's arithmetic allows); null otherwise */
export function tonum(v: Value): number | null {
  if (typeof v === "number") return v;
  if (typeof v !== "string") return null;
  const t = v.trim();
  if (!t) return null;
  const n = /^-?0[xX][0-9a-fA-F]+$/.test(t) ? parseInt(t, 16) : Number(t);
  return Number.isNaN(n) ? null : n;
}

function operand(v: Value, op: string, line: number): number {
  const n = tonum(v);
  if (n === null) return fail(`can't do "${op}" with ${describe(v)}`, line);
  return n;
}

/** a value, said so a person sees what went wrong */
export const describe = (v: Value): string => (typeof v === "string" ? `the text "${v.slice(0, 20)}"` : typeName(v));

const ARITH: Partial<Record<BinOp, (a: number, b: number, line: number) => number>> = {
  "+": (a, b) => a + b,
  "-": (a, b) => a - b,
  "*": (a, b) => a * b,
  "/": (a, b) => a / b,
  "//": (a, b) => Math.floor(a / b),
  "%": (a, b, line) => (b === 0 ? fail("can't take the remainder of a division by zero", line) : a - Math.floor(a / b) * b),
  "^": (a, b) => a ** b,
};

export function arith(op: BinOp, a: Value, b: Value, line: number): number {
  return ARITH[op]!(operand(a, op, line), operand(b, op, line), line);
}

export function concat(a: Value, b: Value, line: number): string {
  for (const v of [a, b]) {
    if (typeof v !== "string" && typeof v !== "number") fail(`can't join ${describe(v)} into text (use tostring)`, line);
  }
  const s = tostr(a) + tostr(b);
  if (s.length > MAX_STRING) fail("this text is too long", line);
  return s;
}

/** < and <=, for numbers with numbers and text with text */
export function less(a: Value, b: Value, orEqual: boolean, line: number): boolean {
  if ((typeof a === "number" && typeof b === "number") || (typeof a === "string" && typeof b === "string")) {
    return orEqual ? a <= b : a < b;
  }
  return fail(`can't compare ${describe(a)} with ${describe(b)}`, line);
}

export function length(v: Value, line: number): number {
  if (typeof v === "string") return v.length;
  if (v instanceof LuaTable) return v.length;
  return fail(`can't take the length of ${describe(v)}`, line);
}

export function binary(op: BinOp, a: Value, b: Value, line: number): Value {
  if (op === "==") return a === b;
  if (op === "~=") return a !== b;
  if (op === "..") return concat(a, b, line);
  if (op === "<") return less(a, b, false, line);
  if (op === "<=") return less(a, b, true, line);
  if (op === ">") return less(b, a, false, line);
  if (op === ">=") return less(b, a, true, line);
  return arith(op, a, b, line);
}
