/**
 * Lua values as plain JSON and back: how a script's `state` is kept on its object, and how a message is copied
 * from one script to another. Only numbers, text, true/false and tables of them go through.
 */
import { fail } from "./errors";
import type { Value } from "./table";
import { LuaTable } from "./table";
import { describe } from "./values";

export type Plain = null | boolean | number | string | Plain[] | { [k: string]: Plain };

const MAX_DEPTH = 16;

/** `what` names it in errors: "state", "a message" */
export function toPlain(v: Value, what: string, line: number, depth = 0): Plain {
  if (v === undefined) return null;
  if (typeof v === "boolean" || typeof v === "string") return v;
  if (typeof v === "number")
    return Number.isFinite(v) ? v : fail(`${what} can't hold ${v} (only ordinary numbers)`, line);
  if (!(v instanceof LuaTable))
    return fail(`${what} can only hold numbers, text, true/false and tables, not ${describe(v)}`, line);
  if (depth >= MAX_DEPTH) return fail(`${what} has tables nested too deep (or a table inside itself)`, line);
  return tableToPlain(v, what, line, depth);
}

function tableToPlain(v: LuaTable, what: string, line: number, depth: number): Plain {
  if (v.size === v.length)
    return Array.from({ length: v.length }, (_, i) => toPlain(v.get(i + 1), what, line, depth + 1));
  const out: { [k: string]: Plain } = {};
  for (const [k, x] of v.entries()) {
    if (typeof k !== "string" && typeof k !== "number") fail(`${what} can only use text and numbers as keys`, line);
    out[String(k)] = toPlain(x, what, line, depth + 1);
  }
  return out;
}

const WHOLE = /^-?(0|[1-9][0-9]{0,14})$/;

export function fromPlain(x: unknown): Value {
  if (x === null || x === undefined) return undefined;
  if (typeof x === "boolean" || typeof x === "string") return x;
  if (typeof x === "number") return Number.isFinite(x) ? x : undefined;
  const t = new LuaTable();
  if (Array.isArray(x)) x.forEach((v, i) => t.set(i + 1, fromPlain(v)));
  else if (typeof x === "object") {
    // keys that were whole numbers come back as numbers, so state.scores[3] stays state.scores[3]
    for (const [k, v] of Object.entries(x)) t.set(WHOLE.test(k) ? Number(k) : k, fromPlain(v));
  }
  return t;
}
