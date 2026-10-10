/** Expressions, by precedence: or < and < not < comparison < additive < multiplicative < unary minus. */
import { KEYWORDS, ScriptError } from "./ast";
import type { Expr } from "./ast";
import type { Tok } from "./lexer";
import { desc } from "./token-stream";
import type { TokenStream } from "./token-stream";

type Level = (ts: TokenStream) => Expr;

export function parseExpr(ts: TokenStream): Expr {
  return parseOr(ts);
}

/** a left-associative chain of binary operators; `named` normalises spellings like `||` to `or` */
function leftAssoc(ts: TokenStream, ops: string[], below: Level, named?: string): Expr {
  let a = below(ts);
  while (ops.some((op) => ts.is(op))) {
    const t = ts.next();
    a = { k: "bin", op: named ?? t.v, a, b: below(ts), line: t.line };
  }
  return a;
}

function parseOr(ts: TokenStream): Expr {
  return leftAssoc(ts, ["or", "||"], parseAnd, "or");
}

function parseAnd(ts: TokenStream): Expr {
  return leftAssoc(ts, ["and", "&&"], parseNot, "and");
}

function parseNot(ts: TokenStream): Expr {
  if (ts.is("not") || ts.is("!")) {
    ts.next();
    return { k: "un", op: "not", e: parseNot(ts) };
  }
  return parseCmp(ts);
}

function parseCmp(ts: TokenStream): Expr {
  return leftAssoc(ts, ["==", "!=", "<", ">", "<=", ">="], parseAdd);
}

function parseAdd(ts: TokenStream): Expr {
  return leftAssoc(ts, ["+", "-"], parseMul);
}

function parseMul(ts: TokenStream): Expr {
  return leftAssoc(ts, ["*", "/", "%"], parseUnary);
}

function parseUnary(ts: TokenStream): Expr {
  if (ts.is("-")) {
    ts.next();
    return { k: "un", op: "-", e: parseUnary(ts) };
  }
  return parsePrimary(ts);
}

function parsePrimary(ts: TokenStream): Expr {
  const t = ts.next();
  if (t.t === "num") return numberLiteral(t);
  if (t.t === "str") return { k: "lit", v: t.v };
  if (t.t === "op" && t.v === "(") return parenthesised(ts, t);
  if (t.t === "id") return nameOrCall(ts, t);
  throw new ScriptError(`expected a value but found ${desc(t)}`, t.line);
}

function numberLiteral(t: Tok): Expr {
  const v = Number(t.v);
  if (!isFinite(v)) throw new ScriptError(`"${t.v}" is not a number`, t.line);
  return { k: "lit", v };
}

function parenthesised(ts: TokenStream, open: Tok): Expr {
  ts.enter(open.line);
  const e = parseExpr(ts);
  ts.expect(")");
  ts.leave();
  return e;
}

function nameOrCall(ts: TokenStream, t: Tok): Expr {
  if (t.v === "true" || t.v === "false") return { k: "lit", v: t.v === "true" };
  if (KEYWORDS.has(t.v)) throw new ScriptError(`"${t.v}" can't be used here`, t.line);
  if (!ts.is("(")) return { k: "var", n: t.v, line: t.line };
  ts.next();
  return { k: "call", n: t.v, a: parseArgs(ts), line: t.line };
}

/** comma-separated values up to the closing ")" */
function parseArgs(ts: TokenStream): Expr[] {
  const a: Expr[] = [];
  if (!ts.is(")")) {
    a.push(parseExpr(ts));
    while (ts.is(",")) {
      ts.next();
      a.push(parseExpr(ts));
    }
  }
  ts.expect(")");
  return a;
}
