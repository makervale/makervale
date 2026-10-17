/**
 * Lua patterns, ported from Lua 5.1's lstrlib.c: character classes (%a %d %s %w …, [sets], .), the repeats * + - ?,
 * anchors ^ $, (captures) and () positions, %b() balanced pairs, %f[frontiers] and %1 back-references.
 * Matching counts its work, so a pattern that backtracks without end stops with an error instead of a frozen page.
 */
import { fail } from "./errors";

const UNFINISHED = -1;
const POSITION = -2;
const MAX_CAPTURES = 32;
/** work one match may take */
const MAX_WORK = 200_000;

export type Capture = string | number;

interface Cap {
  init: number;
  len: number;
}

const between = (c: number, lo: string, hi: string): boolean => c >= lo.charCodeAt(0) && c <= hi.charCodeAt(0);
const lower = (c: number) => between(c, "a", "z");
const upper = (c: number) => between(c, "A", "Z");
const digit = (c: number) => between(c, "0", "9");
const alnum = (c: number) => lower(c) || upper(c) || digit(c);
const graph = (c: number) => c > 32 && c < 127;

const CLASSES: Record<string, (c: number) => boolean> = {
  a: (c) => lower(c) || upper(c),
  c: (c) => c < 32 || c === 127,
  d: digit,
  g: graph,
  l: lower,
  p: (c) => graph(c) && !alnum(c),
  s: (c) => c === 32 || (c >= 9 && c <= 13),
  u: upper,
  w: alnum,
  x: (c) => digit(c) || between(c, "a", "f") || between(c, "A", "F"),
};

/** %a, %d …: the lower-case letter is the class, the upper-case one everything else; any other character itself */
function matchClass(c: number, cl: string): boolean {
  const key = cl.toLowerCase();
  if (!Object.hasOwn(CLASSES, key)) return cl.charCodeAt(0) === c;
  return CLASSES[key](c) === (cl === key);
}

export class Matcher {
  level = 0;
  readonly caps: Cap[] = [];
  private work = 0;

  constructor(
    readonly src: string,
    readonly pat: string,
    private readonly line: number,
  ) {}

  private bad(msg: string): never {
    return fail(`malformed pattern (${msg})`, this.line);
  }

  private classEnd(p: number): number {
    const c = this.pat[p++];
    if (c === "%") {
      if (p >= this.pat.length) this.bad("ends with %");
      return p + 1;
    }
    if (c !== "[") return p;
    if (this.pat[p] === "^") p++;
    do {
      if (p >= this.pat.length) this.bad('missing "]"');
      if (this.pat[p++] === "%") p++;
    } while (this.pat[p] !== "]");
    return p + 1;
  }

  private bracket(c: number, p: number, ec: number): boolean {
    let sig = true;
    if (this.pat[p + 1] === "^") {
      sig = false;
      p++;
    }
    while (++p < ec) {
      if (this.pat[p] === "%") {
        if (matchClass(c, this.pat[++p])) return sig;
      } else if (this.pat[p + 1] === "-" && p + 2 < ec) {
        p += 2;
        if (this.pat.charCodeAt(p - 2) <= c && c <= this.pat.charCodeAt(p)) return sig;
      } else if (this.pat.charCodeAt(p) === c) return sig;
    }
    return !sig;
  }

  private single(s: number, p: number, ep: number): boolean {
    if (s >= this.src.length) return false;
    const c = this.src.charCodeAt(s);
    const pc = this.pat[p];
    if (pc === ".") return true;
    if (pc === "%") return matchClass(c, this.pat[p + 1]);
    if (pc === "[") return this.bracket(c, p, ep - 1);
    return this.pat.charCodeAt(p) === c;
  }

  /** where the match of pat[p…] at src[s…] ends, or -1 */
  match(s: number, p: number): number {
    if (++this.work > MAX_WORK) fail("this pattern takes too long to match", this.line);
    while (p < this.pat.length) {
      const special = this.special(s, p);
      if (special !== null) {
        if (special.done) return special.s;
        [s, p] = [special.s, special.p];
        continue;
      }
      const ep = this.classEnd(p);
      const q = this.pat[ep];
      if (q === "?" || q === "*" || q === "+" || q === "-") return this.repeat(s, p, ep, q);
      if (!this.single(s, p, ep)) return -1;
      [s, p] = [s + 1, ep];
    }
    return s;
  }

  private repeat(s: number, p: number, ep: number, q: string): number {
    const m = this.single(s, p, ep);
    if (q === "?") {
      const r = m ? this.match(s + 1, ep + 1) : -1;
      return r !== -1 ? r : this.match(s, ep + 1);
    }
    if (q === "-") return this.minExpand(s, p, ep);
    if (q === "+" && !m) return -1;
    return this.maxExpand(q === "+" ? s + 1 : s, p, ep);
  }

  private maxExpand(s: number, p: number, ep: number): number {
    let i = 0;
    while (this.single(s + i, p, ep)) i++;
    for (; i >= 0; i--) {
      const r = this.match(s + i, ep + 1);
      if (r !== -1) return r;
    }
    return -1;
  }

  private minExpand(s: number, p: number, ep: number): number {
    for (;;) {
      const r = this.match(s, ep + 1);
      if (r !== -1) return r;
      if (!this.single(s, p, ep)) return -1;
      s++;
    }
  }

  /** ( ) $ %b %f %1: the result when it decides the match, or where matching goes on, or null for a plain item */
  private special(s: number, p: number): { done: boolean; s: number; p: number } | null {
    const pc = this.pat[p];
    const done = (r: number) => ({ done: true, s: r, p });
    if (pc === "(") return done(this.startCapture(s, p));
    if (pc === ")") return done(this.endCapture(s, p + 1));
    if (pc === "$" && p + 1 === this.pat.length) return done(s === this.src.length ? s : -1);
    if (pc !== "%") return null;
    const nx = this.pat[p + 1];
    if (nx === "b") return this.balance(s, p);
    if (nx === "f") return this.frontier(s, p);
    if (nx >= "0" && nx <= "9") return this.backref(s, p, Number(nx));
    return null;
  }

  private startCapture(s: number, p: number): number {
    if (this.level >= MAX_CAPTURES) fail("too many captures in this pattern", this.line);
    const position = this.pat[p + 1] === ")";
    this.caps[this.level++] = { init: s, len: position ? POSITION : UNFINISHED };
    const r = this.match(s, p + (position ? 2 : 1));
    if (r === -1) this.level--;
    return r;
  }

  private endCapture(s: number, p: number): number {
    let l = this.level - 1;
    while (l >= 0 && this.caps[l].len !== UNFINISHED) l--;
    if (l < 0) this.bad('a ")" without its "("');
    this.caps[l].len = s - this.caps[l].init;
    const r = this.match(s, p);
    if (r === -1) this.caps[l].len = UNFINISHED;
    return r;
  }

  private balance(s: number, p: number): { done: boolean; s: number; p: number } {
    if (p + 3 >= this.pat.length) this.bad("missing arguments to %b");
    const [open, close] = [this.pat[p + 2], this.pat[p + 3]];
    if (this.src[s] !== open) return { done: true, s: -1, p };
    let depth = 1;
    for (let i = s + 1; i < this.src.length; i++) {
      if (this.src[i] === close && --depth === 0) return { done: false, s: i + 1, p: p + 4 };
      if (this.src[i] === open) depth++;
    }
    return { done: true, s: -1, p };
  }

  private frontier(s: number, p: number): { done: boolean; s: number; p: number } {
    p += 2;
    if (this.pat[p] !== "[") this.bad('missing "[" after %f');
    const ep = this.classEnd(p);
    const prev = s === 0 ? 0 : this.src.charCodeAt(s - 1);
    const cur = s < this.src.length ? this.src.charCodeAt(s) : 0;
    const ok = !this.bracket(prev, p, ep - 1) && this.bracket(cur, p, ep - 1);
    return ok ? { done: false, s, p: ep } : { done: true, s: -1, p };
  }

  private backref(s: number, p: number, n: number): { done: boolean; s: number; p: number } {
    const cap = this.caps[n - 1];
    if (n < 1 || n > this.level || !cap || cap.len === UNFINISHED) this.bad(`invalid capture %${n}`);
    const text = this.src.substr(cap.init, cap.len);
    if (this.src.startsWith(text, s)) return { done: false, s: s + text.length, p: p + 2 };
    return { done: true, s: -1, p };
  }

  /** capture i of a match from s to e (the whole match when the pattern has no captures) */
  capture(i: number, s: number, e: number): Capture {
    if (i >= this.level) {
      if (i === 0) return this.src.slice(s, e);
      return this.bad(`invalid capture index %${i + 1}`);
    }
    const cap = this.caps[i];
    if (cap.len === UNFINISHED) this.bad("unfinished capture");
    return cap.len === POSITION ? cap.init + 1 : this.src.substr(cap.init, cap.len);
  }

  captures(s: number, e: number, wholeIfNone: boolean): Capture[] {
    const n = this.level === 0 && wholeIfNone ? 1 : this.level;
    return Array.from({ length: n }, (_, i) => this.capture(i, s, e));
  }
}
