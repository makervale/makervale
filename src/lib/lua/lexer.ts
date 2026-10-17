/** Source text → tokens. */
import { fail } from "./errors";
import type { Cursor, InterpPart } from "./lex-strings";
import { longBracket, readInterp, readQuoted } from "./lex-strings";

export type { InterpPart };

export type TokKind = "num" | "str" | "name" | "kw" | "op" | "interp" | "eof";

export interface Tok {
  t: TokKind;
  v: string;
  line: number;
  num?: number;
  parts?: InterpPart[];
}

export const KEYWORDS: ReadonlySet<string> = new Set(
  "and break continue do else elseif end false for function if in local nil not or repeat return then true until while".split(
    " ",
  ),
);

/** longest first, so ".." is not read as "." "." */
const OPS = [
  "...",
  "..=",
  "//=",
  "==",
  "~=",
  "<=",
  ">=",
  "//",
  "..",
  "+=",
  "-=",
  "*=",
  "/=",
  "%=",
  "^=",
  "::",
  ..."+-*/%^#<>=(){}[];:,.".split(""),
];

export function lex(src: string): Tok[] {
  const out: Tok[] = [];
  const cur: Cursor = { src, i: 0, line: 1 };
  for (;;) {
    skipSpaceAndComments(cur);
    if (cur.i >= src.length) break;
    out.push(nextToken(cur));
  }
  out.push({ t: "eof", v: "<end>", line: cur.line });
  return out;
}

function skipSpaceAndComments(cur: Cursor): void {
  while (cur.i < cur.src.length) {
    const c = cur.src[cur.i];
    if (c === "\n") cur.line++;
    if (c === " " || c === "\t" || c === "\r" || c === "\n") cur.i++;
    else if (cur.src.startsWith("--", cur.i)) skipComment(cur);
    else return;
  }
}

function skipComment(cur: Cursor): void {
  cur.i += 2;
  if (cur.src[cur.i] === "[" && longBracket(cur) !== null) return;
  while (cur.i < cur.src.length && cur.src[cur.i] !== "\n") cur.i++;
}

function nextToken(cur: Cursor): Tok {
  const c = cur.src[cur.i];
  const line = cur.line;
  if (/[0-9]/.test(c) || (c === "." && /[0-9]/.test(cur.src[cur.i + 1] ?? ""))) return readNumber(cur);
  if (c === '"' || c === "'") return { t: "str", v: readQuoted(cur, c), line };
  if (c === "`") return { t: "interp", v: "`", parts: readInterp(cur), line };
  if (c === "[" && (cur.src[cur.i + 1] === "[" || cur.src[cur.i + 1] === "=")) {
    const s = longBracket(cur);
    if (s !== null) return { t: "str", v: s, line };
  }
  if (/[A-Za-z_]/.test(c)) return readName(cur);
  return readOp(cur);
}

function readName(cur: Cursor): Tok {
  const m = /^[A-Za-z_][A-Za-z0-9_]*/.exec(cur.src.slice(cur.i, cur.i + 200))!;
  cur.i += m[0].length;
  return { t: KEYWORDS.has(m[0]) ? "kw" : "name", v: m[0], line: cur.line };
}

const NUMBER = /^(0[xX][0-9a-fA-F]+|(\d+\.?\d*|\.\d+)([eE][+-]?\d+)?)/;

function readNumber(cur: Cursor): Tok {
  const m = NUMBER.exec(cur.src.slice(cur.i, cur.i + 400));
  if (!m) return fail("malformed number", cur.line);
  cur.i += m[0].length;
  if (/[A-Za-z_]/.test(cur.src[cur.i] ?? "")) fail(`malformed number near "${m[0]}${cur.src[cur.i]}"`, cur.line);
  return { t: "num", v: m[0], num: Number(m[0]), line: cur.line };
}

function readOp(cur: Cursor): Tok {
  if (cur.src.startsWith("!=", cur.i)) fail('use "~=" for "not equal"', cur.line);
  const op = OPS.find((o) => cur.src.startsWith(o, cur.i));
  if (!op) return fail(`unexpected symbol "${cur.src[cur.i]}"`, cur.line);
  cur.i += op.length;
  return { t: "op", v: op, line: cur.line };
}
