/** How script values behave: truthiness, coercion to numbers, printing, and the string cap. */
import { ScriptError } from "./ast";
import type { Val } from "./ast";

export const MAX_STR = 1000;

export const truthy = (v: Val): boolean => (typeof v === "string" ? v.length > 0 : !!v);

/** `what` names the operation for the error message, e.g. `"+" needs a number, not "abc"` */
export function num(v: Val, line: number, what: string): number {
  if (typeof v === "number") return v;
  if (typeof v === "boolean") return v ? 1 : 0;
  const n = Number(v);
  if (v.trim() !== "" && isFinite(n)) return n;
  throw new ScriptError(`${what} needs a number, not "${String(v).slice(0, 30)}"`, line);
}

/** a value as the user sees it: numbers rounded to 4 places */
export const show = (v: Val): string => (typeof v === "number" ? String(Math.round(v * 1e4) / 1e4) : String(v));

export const cap = (s: string): string => (s.length > MAX_STR ? s.slice(0, MAX_STR) : s);

/** `+` joins text when either side is text, otherwise adds */
export function plus(a: Val, b: Val, line: number, what: string): Val {
  if (typeof a === "string" || typeof b === "string") return cap(show(a) + show(b));
  return num(a, line, what) + num(b, line, what);
}

/** loose equality: same value, or the same text once both are shown */
export const equal = (a: Val, b: Val): boolean => a === b || (typeof a !== typeof b && show(a) === show(b));
