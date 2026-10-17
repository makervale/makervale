/** The text parts of the lexer: "quoted" and 'quoted' strings, [[long]] strings, and `interpolated {strings}`. */
import { MAX_STRING, fail } from "./errors";

/** a piece of `text {expr} text`: plain text, or the source of an expression and its line */
export type InterpPart = string | { src: string; line: number };

export interface Cursor {
  src: string;
  i: number;
  line: number;
}

const ESCAPES: Record<string, string> = { n: "\n", t: "\t", r: "\r", a: "\x07", b: "\b", f: "\f", v: "\v" };

/** after a backslash: the character it stands for */
function escape(cur: Cursor): string {
  const c = cur.src[cur.i++];
  if (c in ESCAPES) return ESCAPES[c];
  if (c === "x") {
    const hex = cur.src.slice(cur.i, cur.i + 2);
    if (!/^[0-9a-fA-F]{2}$/.test(hex)) fail("bad \\x escape in a string", cur.line);
    cur.i += 2;
    return String.fromCharCode(parseInt(hex, 16));
  }
  const dec = /^[0-9]{1,3}/.exec(cur.src.slice(cur.i - 1, cur.i + 2));
  if (dec) {
    cur.i += dec[0].length - 1;
    return String.fromCharCode(Number(dec[0]) & 0xff);
  }
  if (c === "\n") cur.line++;
  return c ?? "";
}

export function readQuoted(cur: Cursor, quote: string): string {
  const line = cur.line;
  cur.i++;
  let out = "";
  for (;;) {
    const c = cur.src[cur.i++];
    if (c === undefined || c === "\n") return fail("this text is missing its closing quote", line);
    if (c === quote) return out;
    out += c === "\\" ? escape(cur) : c;
    if (out.length > MAX_STRING) fail("this text is too long", line);
  }
}

/** [[...]] or [==[...]==] at the cursor (a comment's too); null if the cursor isn't at one */
export function longBracket(cur: Cursor): string | null {
  const m = /^\[(=*)\[/.exec(cur.src.slice(cur.i, cur.i + 100));
  if (!m) return null;
  const close = "]" + m[1] + "]";
  const start = cur.i + m[0].length;
  const end = cur.src.indexOf(close, start);
  if (end < 0) return fail(`this long text or comment is missing its closing "${close}"`, cur.line);
  let text = cur.src.slice(start, end);
  cur.line += (cur.src.slice(cur.i, end).match(/\n/g) ?? []).length;
  cur.i = end + close.length;
  if (text.startsWith("\n")) text = text.slice(1);
  return text;
}

/** `Hello {name}!`: text and the expressions in braces, in order */
export function readInterp(cur: Cursor): InterpPart[] {
  const line = cur.line;
  cur.i++;
  const parts: InterpPart[] = [];
  let text = "";
  for (;;) {
    const c = cur.src[cur.i++];
    if (c === undefined) return fail("this `text` is missing its closing backtick", line);
    if (c === "`") break;
    if (c === "\n") cur.line++;
    if (c === "\\") text += escape(cur);
    else if (c === "{") {
      if (text) parts.push(text);
      text = "";
      parts.push(readHole(cur));
    } else text += c;
  }
  if (text) parts.push(text);
  return parts;
}

function readHole(cur: Cursor): InterpPart {
  const line = cur.line;
  const end = cur.src.indexOf("}", cur.i);
  if (end < 0) return fail('a "{" in this `text` is missing its "}"', line);
  const src = cur.src.slice(cur.i, end);
  cur.line += (src.match(/\n/g) ?? []).length;
  cur.i = end + 1;
  return { src, line };
}
