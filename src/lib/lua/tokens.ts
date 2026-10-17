/** Walking the tokens while parsing, with errors that say what was expected and what came instead. */
import { fail } from "./errors";
import type { Tok } from "./lexer";

const shown = (t: Tok): string => (t.t === "eof" ? "the end of the script" : `"${t.v}"`);

export class Tokens {
  private i = 0;

  constructor(private readonly toks: Tok[]) {}

  peek(ahead = 0): Tok {
    return this.toks[Math.min(this.i + ahead, this.toks.length - 1)];
  }

  next(): Tok {
    const t = this.peek();
    if (this.i < this.toks.length - 1) this.i++;
    return t;
  }

  get line(): number {
    return this.peek().line;
  }

  /** is the next token this keyword or operator? */
  is(v: string): boolean {
    const t = this.peek();
    return (t.t === "kw" || t.t === "op") && t.v === v;
  }

  accept(v: string): boolean {
    if (!this.is(v)) return false;
    this.next();
    return true;
  }

  expect(v: string, why = ""): Tok {
    if (this.is(v)) return this.next();
    return fail(`expected "${v}"${why ? " " + why : ""}, but found ${shown(this.peek())}`, this.line);
  }

  name(what = "a name"): string {
    const t = this.peek();
    if (t.t !== "name") fail(`expected ${what}, but found ${shown(t)}`, t.line);
    return this.next().v;
  }

  unexpected(): never {
    const t = this.peek();
    return fail(`unexpected ${shown(t)}`, t.line);
  }

  atEnd(): boolean {
    return this.peek().t === "eof";
  }
}
