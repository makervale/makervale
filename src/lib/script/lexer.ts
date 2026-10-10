/** Source text → tokens. Newlines and ";" are tokens because they end statements. */
import { ScriptError } from "./ast";

export type TokKind = "num" | "str" | "id" | "op" | "nl" | "eof";

export interface Tok {
  t: TokKind;
  v: string;
  line: number;
}

const TWO_CHAR_OPS = ["==", "!=", "<=", ">=", "&&", "||", "+=", "-="];
const ONE_CHAR_OPS = "+-*/%<>=!(){},";

interface Cursor {
  src: string;
  i: number;
  line: number;
}

export function lex(src: string): Tok[] {
  const out: Tok[] = [];
  const cur: Cursor = { src, i: 0, line: 1 };
  while (cur.i < src.length) {
    const tok = nextToken(cur);
    if (tok) out.push(tok);
  }
  out.push({ t: "eof", v: "", line: cur.line });
  return out;
}

function nextToken(cur: Cursor): Tok | null {
  const c = cur.src[cur.i];
  if (c === "\n") return newline(cur);
  if (isSpace(c)) {
    cur.i++;
    return null;
  }
  if (c === ";") {
    cur.i++;
    return { t: "nl", v: ";", line: cur.line };
  }
  if (isComment(cur)) {
    skipComment(cur);
    return null;
  }
  if (startsNumber(cur)) return readNumber(cur);
  if (isQuote(c)) return readString(cur, c);
  if (/[A-Za-z_]/.test(c)) return readName(cur);
  return readOp(cur);
}

const isSpace = (c: string) => c === " " || c === "\t" || c === "\r";
const isQuote = (c: string) => c === '"' || c === "'";
const isDigit = (c: string) => /[0-9]/.test(c);

function newline(cur: Cursor): Tok {
  const tok: Tok = { t: "nl", v: "\n", line: cur.line };
  cur.line++;
  cur.i++;
  return tok;
}

function isComment(cur: Cursor): boolean {
  const { src, i } = cur;
  return src[i] === "#" || (src[i] === "/" && src[i + 1] === "/");
}

function skipComment(cur: Cursor): void {
  while (cur.i < cur.src.length && cur.src[cur.i] !== "\n") cur.i++;
}

function startsNumber(cur: Cursor): boolean {
  const { src, i } = cur;
  return isDigit(src[i]) || (src[i] === "." && isDigit(src[i + 1] ?? ""));
}

function readNumber(cur: Cursor): Tok {
  const { src, i, line } = cur;
  let j = i;
  while (j < src.length && /[0-9.]/.test(src[j])) j++;
  cur.i = j;
  return { t: "num", v: src.slice(i, j), line };
}

function readString(cur: Cursor, quote: string): Tok {
  const { src, line } = cur;
  let j = cur.i + 1;
  let s = "";
  while (j < src.length && src[j] !== quote) {
    if (src[j] === "\n") throw new ScriptError("text is missing its closing quote", line);
    if (src[j] === "\\" && j + 1 < src.length) {
      s += unescape(src[j + 1]);
      j += 2;
      continue;
    }
    s += src[j++];
  }
  if (j >= src.length) throw new ScriptError("text is missing its closing quote", line);
  cur.i = j + 1;
  return { t: "str", v: s, line };
}

const unescape = (c: string) => (c === "n" ? "\n" : c);

function readName(cur: Cursor): Tok {
  const { src, i, line } = cur;
  let j = i;
  while (j < src.length && /\w/.test(src[j])) j++;
  cur.i = j;
  return { t: "id", v: src.slice(i, j), line };
}

function readOp(cur: Cursor): Tok {
  const { src, i, line } = cur;
  const two = src.slice(i, i + 2);
  if (TWO_CHAR_OPS.includes(two)) {
    cur.i += 2;
    return { t: "op", v: two, line };
  }
  const c = src[i];
  if (ONE_CHAR_OPS.includes(c)) {
    cur.i++;
    return { t: "op", v: c, line };
  }
  throw new ScriptError(`unexpected "${c}"`, line);
}
