/** A cursor over the token list with the small checks every parser rule needs. */
import { KEYWORDS, MAX_NESTING, ScriptError } from "./ast";
import type { Tok } from "./lexer";

export function desc(t: Tok): string {
  if (t.t === "eof") return "the end";
  if (t.t === "nl") return "a new line";
  return `"${t.v}"`;
}

export class TokenStream {
  private p = 0;
  // parentheses and blocks share one depth counter so neither can recurse without bound
  private depth = 0;

  constructor(private readonly toks: Tok[]) {}

  peek(): Tok {
    return this.toks[this.p];
  }

  peekAhead(n: number): Tok | undefined {
    return this.toks[this.p + n];
  }

  next(): Tok {
    return this.toks[this.p++];
  }

  /** is the current token this word or operator? */
  is(v: string): boolean {
    const t = this.peek();
    return (t.t === "op" || t.t === "id") && t.v === v;
  }

  expect(v: string): Tok {
    if (!this.is(v)) throw new ScriptError(`expected "${v}" but found ${desc(this.peek())}`, this.peek().line);
    return this.next();
  }

  skipNl(): void {
    while (this.peek().t === "nl") this.p++;
  }

  name(): string {
    const t = this.next();
    if (t.t !== "id" || KEYWORDS.has(t.v)) throw new ScriptError(`expected a name but found ${desc(t)}`, t.line);
    return t.v;
  }

  /** a statement ends at a newline, the end of the source, or the closing brace of its block */
  endStmt(): void {
    const t = this.peek();
    if (t.t === "nl") {
      this.skipNl();
      return;
    }
    if (t.t === "eof" || this.is("}")) return;
    throw new ScriptError(`unexpected ${desc(t)}`, t.line);
  }

  mark(): number {
    return this.p;
  }

  reset(mark: number): void {
    this.p = mark;
  }

  enter(line: number): void {
    if (++this.depth > MAX_NESTING) throw new ScriptError("too deeply nested", line);
  }

  leave(): void {
    this.depth--;
  }
}
