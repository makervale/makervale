/** Statements and blocks: a whole script parses into one block. */
import type { BinOp, Block, Expr, Stmt, Target } from "./ast";
import { MAX_SOURCE, fail } from "./errors";
import { lex } from "./lexer";
import type { Parser } from "./parse-expr";
import { expr, exprList, funcBody, suffixed } from "./parse-expr";
import { Tokens } from "./tokens";

const BLOCK_ENDS = new Set(["end", "else", "elseif", "until"]);
const UPDATES: Record<string, BinOp> = {
  "+=": "+",
  "-=": "-",
  "*=": "*",
  "/=": "/",
  "//=": "//",
  "%=": "%",
  "^=": "^",
  "..=": "..",
};

export function parse(src: string): Block {
  if (src.length > MAX_SOURCE) fail(`the script is too long (at most ${MAX_SOURCE} characters)`, 0);
  const p: Parser = { toks: new Tokens(lex(src)), block: () => block(p) };
  const body = block(p);
  if (!p.toks.atEnd()) p.toks.unexpected();
  return body;
}

function block(p: Parser): Block {
  const out: Block = [];
  for (;;) {
    const t = p.toks.peek();
    if (t.t === "eof" || (t.t === "kw" && BLOCK_ENDS.has(t.v))) return out;
    if (p.toks.accept(";")) continue;
    const s = statement(p);
    out.push(s);
    if (s.k === "return") {
      p.toks.accept(";");
      return out;
    }
  }
}

function statement(p: Parser): Stmt {
  const t = p.toks.peek();
  const line = t.line;
  if (t.t !== "kw") return exprStatement(p);
  p.toks.next();
  switch (t.v) {
    case "local":
      return local(p, line);
    case "function":
      return functionStmt(p, line);
    case "if":
      return ifStmt(p, line);
    case "while":
      return whileStmt(p, line);
    case "for":
      return forStmt(p, line);
    default:
      return otherStmt(p, t.v, line);
  }
}

function otherStmt(p: Parser, kw: string, line: number): Stmt {
  if (kw === "return") return { k: "return", exprs: endsBlock(p) ? [] : exprList(p), line };
  if (kw === "break") return { k: "break", line };
  if (kw === "continue") return { k: "continue", line };
  if (kw === "do") return { k: "do", body: closed(p, "do", line), line };
  if (kw === "repeat") {
    const body = p.block();
    p.toks.expect("until", `to close the "repeat" on line ${line}`);
    return { k: "repeat", body, c: expr(p), line };
  }
  return fail(`unexpected "${kw}"`, line);
}

const endsBlock = (p: Parser): boolean => {
  const t = p.toks.peek();
  return t.t === "eof" || t.v === ";" || (t.t === "kw" && BLOCK_ENDS.has(t.v));
};

/** a block and its "end" */
function closed(p: Parser, what: string, line: number): Block {
  const body = p.block();
  p.toks.expect("end", `to close the "${what}" on line ${line}`);
  return body;
}

function local(p: Parser, line: number): Stmt {
  if (p.toks.accept("function")) {
    const name = p.toks.name("the function's name");
    return { k: "localfn", name, f: funcBody(p, name, false), line };
  }
  const names = [p.toks.name("a variable name")];
  while (p.toks.accept(",")) names.push(p.toks.name("a variable name"));
  return { k: "local", names, exprs: p.toks.accept("=") ? exprList(p) : [], line };
}

/** function a.b.c:m(...) … end: an assignment of a new function */
function functionStmt(p: Parser, line: number): Stmt {
  let name = p.toks.name("the function's name");
  let target: Target = { k: "name", n: name, line };
  let method = false;
  while (p.toks.is(".") || p.toks.is(":")) {
    method = p.toks.next().v === ":";
    name = p.toks.name("a field name");
    target = { k: "index", o: target, key: { k: "str", v: name }, line };
    if (method) break;
  }
  return { k: "assign", targets: [target], exprs: [{ k: "fn", f: funcBody(p, name, method) }], line };
}

function ifStmt(p: Parser, line: number): Stmt {
  const arms: { c: Expr; body: Block }[] = [];
  let other: Block | null = null;
  do {
    const c = expr(p);
    p.toks.expect("then", "after the condition");
    arms.push({ c, body: p.block() });
  } while (p.toks.accept("elseif"));
  if (p.toks.accept("else")) other = p.block();
  p.toks.expect("end", `to close the "if" on line ${line}`);
  return { k: "if", arms, other, line };
}

function whileStmt(p: Parser, line: number): Stmt {
  const c = expr(p);
  p.toks.expect("do", "after the condition");
  return { k: "while", c, body: closed(p, "while", line), line };
}

function forStmt(p: Parser, line: number): Stmt {
  const first = p.toks.name("a loop variable");
  if (p.toks.accept("=")) {
    const from = expr(p);
    p.toks.expect(",");
    const to = expr(p);
    const step = p.toks.accept(",") ? expr(p) : null;
    p.toks.expect("do");
    return { k: "fornum", v: first, from, to, step, body: closed(p, "for", line), line };
  }
  const names = [first];
  while (p.toks.accept(",")) names.push(p.toks.name("a loop variable"));
  p.toks.expect("in", 'or "=" in the "for"');
  const exprs = exprList(p);
  p.toks.expect("do");
  return { k: "forin", names, exprs, body: closed(p, "for", line), line };
}

const isTarget = (e: Expr): e is Target => e.k === "name" || e.k === "index";

/** a call on its own, an assignment (a, b = …) or an update (a += …) */
function exprStatement(p: Parser): Stmt {
  const line = p.toks.line;
  const e = suffixed(p);
  const op = p.toks.peek();
  if (op.t === "op" && op.v in UPDATES) {
    p.toks.next();
    if (!isTarget(e)) fail(`can't use "${op.v}" here`, line);
    return { k: "update", target: e as Target, op: UPDATES[op.v], e: expr(p), line };
  }
  if (p.toks.is("=") || p.toks.is(",")) return assignment(p, e, line);
  if (e.k === "call" || e.k === "method") return { k: "call", e, line };
  return fail("this line doesn't do anything: call a function or assign a value", line);
}

function assignment(p: Parser, first: Expr, line: number): Stmt {
  const targets = [first];
  while (p.toks.accept(",")) targets.push(suffixed(p));
  p.toks.expect("=");
  for (const t of targets) if (!isTarget(t)) fail("can't assign to this", line);
  return { k: "assign", targets: targets as Target[], exprs: exprList(p), line };
}
