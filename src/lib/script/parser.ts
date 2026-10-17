/** Tokens → Program: top-level `var`s and `on …` handlers, each a block of statements. */
import { EVENTS, KEYWORDS, MAX_HANDLERS, MAX_SOURCE, ScriptError, actionSpec, isEvent } from "./ast";
import type { ActionSpec, EventName, Expr, Handler, Program, Stmt } from "./ast";
import { lex } from "./lexer";
import type { Tok } from "./lexer";
import { parseExpr } from "./parse-expr";
import { TokenStream, desc } from "./token-stream";

const ASSIGN_OPS = ["=", "+=", "-="];

export function parse(src: string): Program {
  if (src.length > MAX_SOURCE) throw new ScriptError(`scripts can be at most ${MAX_SOURCE} characters`, 1);
  const ts = new TokenStream(lex(src));
  const prog: Program = { globals: [], handlers: [] };
  ts.skipNl();
  while (ts.peek().t !== "eof") parseTopLevel(ts, prog);
  if (prog.handlers.length > MAX_HANDLERS) throw new ScriptError(`at most ${MAX_HANDLERS} event handlers`, 1);
  return prog;
}

function parseTopLevel(ts: TokenStream, prog: Program): void {
  const t = ts.peek();
  if (t.t === "id" && t.v === "on") {
    prog.handlers.push(parseHandler(ts));
    return;
  }
  if (t.t === "id" && t.v === "var") {
    prog.globals.push(parseStmt(ts));
    return;
  }
  throw new ScriptError(`only "var" and "on …" can be at the top (found ${desc(t)})`, t.line);
}

function parseHandler(ts: TokenStream): Handler {
  const line = ts.next().line;
  const ev = ts.next();
  if (!isEvent(ev.v)) throw new ScriptError(`"${ev.v}" is not an event (try ${EVENTS.join(", ")})`, ev.line);
  const arg = parseEventArg(ts, ev.v);
  const body = parseBlock(ts);
  ts.endStmt();
  return { ev: ev.v, arg, body, line };
}

/** timer and near take a number; hear takes an optional word; start, touch and bump take nothing */
const EVENT_ARGS: Record<EventName, "number" | "word" | "none"> = {
  start: "none",
  touch: "none",
  timer: "number",
  near: "number",
  hear: "word",
  bump: "none",
  blocked: "none",
};

function parseEventArg(ts: TokenStream, ev: EventName): Expr | null {
  const kind = EVENT_ARGS[ev];
  if (kind === "number") return parseExpr(ts);
  if (kind === "word" && ts.peek().t === "str") return { k: "lit", v: ts.next().v };
  return null;
}

function parseBlock(ts: TokenStream): Stmt[] {
  ts.expect("{");
  ts.enter(ts.peek().line);
  ts.skipNl();
  const out: Stmt[] = [];
  while (!ts.is("}")) {
    const t = ts.peek();
    if (t.t === "eof") throw new ScriptError('a block is missing its closing "}"', t.line);
    out.push(parseStmt(ts));
  }
  ts.next();
  ts.leave();
  return out;
}

function parseStmt(ts: TokenStream): Stmt {
  const t = ts.peek();
  if (t.t !== "id") throw new ScriptError(`expected an instruction but found ${desc(t)}`, t.line);
  if (t.v === "if") {
    ts.next();
    return parseIfRest(ts, t.line);
  }
  const s = parseSimpleStmt(ts, t);
  ts.endStmt();
  return s;
}

function parseSimpleStmt(ts: TokenStream, t: Tok): Stmt {
  const line = t.line;
  switch (t.v) {
    case "var":
      ts.next();
      return parseVar(ts, line);
    case "repeat":
      ts.next();
      return { k: "repeat", n: parseExpr(ts), body: parseBlock(ts), line };
    case "while":
      ts.next();
      return { k: "while", c: parseExpr(ts), body: parseBlock(ts), line };
    case "wait":
      ts.next();
      return { k: "wait", e: parseExpr(ts), line };
    case "stop":
      ts.next();
      return { k: "stop", line };
  }
  const spec = actionSpec(t.v);
  if (spec) {
    ts.next();
    return parseAction(ts, t.v, spec, line);
  }
  if (isAssignment(ts, t)) return parseSet(ts, line);
  throw new ScriptError(`"${t.v}" is not something a script can do`, line);
}

function parseVar(ts: TokenStream, line: number): Stmt {
  const n = ts.name();
  let e: Expr | null = null;
  if (ts.is("=")) {
    ts.next();
    e = parseExpr(ts);
  }
  return { k: "var", n, e, line };
}

function isAssignment(ts: TokenStream, t: Tok): boolean {
  if (KEYWORDS.has(t.v)) return false;
  const after = ts.peekAhead(1);
  return after !== undefined && after.t === "op" && ASSIGN_OPS.includes(after.v);
}

function parseSet(ts: TokenStream, line: number): Stmt {
  const n = ts.name();
  const op = ts.next().v;
  return { k: "set", n, op, e: parseExpr(ts), line };
}

function parseAction(ts: TokenStream, n: string, spec: ActionSpec, line: number): Stmt {
  const a: Expr[] = [];
  for (let i = 0; i < spec.args; i++) {
    if (i) ts.expect(",");
    a.push(parseExpr(ts));
  }
  for (let i = 0; i < (spec.opt ?? 0) && ts.is(","); i++) {
    ts.next();
    a.push(parseExpr(ts));
  }
  return { k: "act", n, a, dur: parseDuration(ts, n, spec, line), line };
}

function parseDuration(ts: TokenStream, n: string, spec: ActionSpec, line: number): Expr | null {
  if (!ts.is("in")) return null;
  if (!spec.timed) throw new ScriptError(`"${n}" happens at once and can't take "in"`, line);
  ts.next();
  return parseExpr(ts);
}

/** after the `if` keyword: condition, block, and an optional else / else if */
function parseIfRest(ts: TokenStream, line: number): Stmt {
  const c = parseExpr(ts);
  const a = parseBlock(ts);
  return { k: "if", c, a, b: parseElse(ts), line };
}

function parseElse(ts: TokenStream): Stmt[] | null {
  // an `else` may sit on the next line; if it is not there, the newline ends the statement instead
  const save = ts.mark();
  ts.skipNl();
  if (!ts.is("else")) {
    ts.reset(save);
    ts.endStmt();
    return null;
  }
  ts.next();
  if (ts.is("if")) {
    const l = ts.next().line;
    return [parseIfRest(ts, l)];
  }
  const b = parseBlock(ts);
  ts.endStmt();
  return b;
}
