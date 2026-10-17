/** Expressions, by precedence climbing (the priorities are Lua 5.3's). */
import type { BinOp, Block, Expr, FuncBody, TableItem, UnOp } from "./ast";
import { fail } from "./errors";
import { lex } from "./lexer";
import type { InterpPart } from "./lexer";
import { Tokens } from "./tokens";

/** what expressions need from the statement parser: a function's body */
export interface Parser {
  toks: Tokens;
  block(): Block;
}

/** [left, right] priority: right < left makes an operator right-associative */
const BINARY: Partial<Record<string, [number, number]>> = {
  or: [1, 1],
  and: [2, 2],
  "<": [3, 3],
  ">": [3, 3],
  "<=": [3, 3],
  ">=": [3, 3],
  "~=": [3, 3],
  "==": [3, 3],
  "..": [9, 8],
  "+": [10, 10],
  "-": [10, 10],
  "*": [11, 11],
  "/": [11, 11],
  "//": [11, 11],
  "%": [11, 11],
  "^": [14, 13],
};
const UNARY_PRIORITY = 12;

export function expr(p: Parser, limit = 0): Expr {
  const t = p.toks.peek();
  let e: Expr;
  if ((t.t === "kw" && t.v === "not") || (t.t === "op" && (t.v === "#" || t.v === "-"))) {
    p.toks.next();
    e = { k: "un", op: t.v as UnOp, e: expr(p, UNARY_PRIORITY), line: t.line };
  } else e = simple(p);
  for (;;) {
    const op = p.toks.peek();
    const prio = op.t === "op" || op.t === "kw" ? BINARY[op.v] : undefined;
    if (!prio || prio[0] <= limit) return e;
    p.toks.next();
    e = { k: "bin", op: op.v as BinOp, a: e, b: expr(p, prio[1]), line: op.line };
  }
}

/** the token just looked at stands for `e` */
function took<T>(p: Parser, e: T): T {
  p.toks.next();
  return e;
}

function simple(p: Parser): Expr {
  const t = p.toks.peek();
  if (t.t === "num") return took(p, { k: "num", v: t.num! });
  if (t.t === "str") return took(p, { k: "str", v: t.v });
  if (t.t === "interp") return took(p, interp(t.parts!, t.line));
  if (t.v === "{") return table(p);
  if (t.t !== "kw" && t.v !== "...") return suffixed(p);
  if (t.v === "nil") return took(p, { k: "nil" });
  if (t.v === "true" || t.v === "false") return took(p, { k: "bool", v: t.v === "true" });
  if (t.v === "function") {
    p.toks.next();
    return { k: "fn", f: funcBody(p, "function", false) };
  }
  if (t.v === "...") return took(p, { k: "vararg", line: t.line });
  return p.toks.unexpected();
}

/** a name or (expr), then any number of .field [key] :method(args) (args) */
export function suffixed(p: Parser): Expr {
  let e = primary(p);
  for (;;) {
    const t = p.toks.peek();
    if (t.v === "." && t.t === "op") {
      p.toks.next();
      e = { k: "index", o: e, key: { k: "str", v: p.toks.name("a field name") }, line: t.line };
    } else if (t.v === "[" && t.t === "op") {
      p.toks.next();
      e = { k: "index", o: e, key: expr(p), line: t.line };
      p.toks.expect("]");
    } else if (t.v === ":" && t.t === "op") {
      p.toks.next();
      const name = p.toks.name("a method name");
      e = { k: "method", o: e, name, args: args(p), line: t.line };
    } else if (startsArgs(p)) e = { k: "call", f: e, args: args(p), line: t.line };
    else return e;
  }
}

function primary(p: Parser): Expr {
  const t = p.toks.peek();
  if (t.t === "name") return took(p, { k: "name", n: t.v, line: t.line });
  if (t.v === "(" && t.t === "op") {
    p.toks.next();
    const e = expr(p);
    p.toks.expect(")");
    return { k: "paren", e };
  }
  return p.toks.unexpected();
}

const startsArgs = (p: Parser): boolean => {
  const t = p.toks.peek();
  return t.t === "str" || t.t === "interp" || (t.t === "op" && (t.v === "(" || t.v === "{"));
};

function args(p: Parser): Expr[] {
  const t = p.toks.peek();
  if (t.t === "str" || t.t === "interp") return [simple(p)];
  if (t.v === "{") return [table(p)];
  p.toks.expect("(");
  const out = p.toks.is(")") ? [] : exprList(p);
  p.toks.expect(")", "to close the call");
  return out;
}

export function exprList(p: Parser): Expr[] {
  const out = [expr(p)];
  while (p.toks.accept(",")) out.push(expr(p));
  return out;
}

function table(p: Parser): Expr {
  const line = p.toks.expect("{").line;
  const items: TableItem[] = [];
  while (!p.toks.is("}")) {
    items.push(tableItem(p));
    if (!p.toks.accept(",") && !p.toks.accept(";")) break;
  }
  p.toks.expect("}", "to close the table");
  return { k: "table", items, line };
}

function tableItem(p: Parser): TableItem {
  if (p.toks.accept("[")) {
    const key = expr(p);
    p.toks.expect("]");
    p.toks.expect("=");
    return { k: "keyed", key, v: expr(p) };
  }
  if (p.toks.peek().t === "name" && p.toks.peek(1).v === "=" && p.toks.peek(1).t === "op") {
    const key = p.toks.next().v;
    p.toks.next();
    return { k: "named", key, v: expr(p) };
  }
  return { k: "pos", v: expr(p) };
}

/** `(params) body end`; a method gets "self" first */
export function funcBody(p: Parser, name: string, method: boolean): FuncBody {
  const line = p.toks.expect("(").line;
  const params = method ? ["self"] : [];
  let vararg = false;
  while (!p.toks.is(")")) {
    if ((vararg = p.toks.accept("..."))) break;
    params.push(p.toks.name("a parameter name"));
    if (!p.toks.accept(",")) break;
  }
  p.toks.expect(")", "after the parameters");
  const body = p.block();
  p.toks.expect("end", `to close the function that starts on line ${line}`);
  return { params, vararg, body, name, line };
}

/** `Hello {name}!`: each {…} is parsed as an expression of its own */
function interp(parts: InterpPart[], line: number): Expr {
  const out = parts.map((part): string | Expr => {
    if (typeof part === "string") return part;
    const toks = lex(part.src).map((t) => ({ ...t, line: t.line + part.line - 1 }));
    const sub: Parser = { toks: new Tokens(toks), block: () => fail("a function can't go inside {…}", part.line) };
    const e = expr(sub);
    if (!sub.toks.atEnd()) sub.toks.unexpected();
    return e;
  });
  return { k: "interp", parts: out, line };
}
