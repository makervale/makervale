/** The vocabulary of Piaskownica Script: what a program is made of, and the limits every part of the
 *  language agrees on. The language is a tiny event-driven one with no access to anything but the object
 *  it lives in: no eval, no page, no network. */

export type Val = number | string | boolean;

export class ScriptError extends Error {
  readonly line: number;

  constructor(msg: string, line: number) {
    super(`line ${line}: ${msg}`);
    this.line = line;
  }
}

export const MAX_SOURCE = 10_000;
export const MAX_HANDLERS = 32;
export const MAX_NESTING = 64;

export const KEYWORDS: ReadonlySet<string> = new Set([
  "var",
  "on",
  "if",
  "else",
  "repeat",
  "while",
  "wait",
  "stop",
  "in",
  "and",
  "or",
  "not",
  "true",
  "false",
]);

/** `args` positional values, `opt` further optional ones (the material slot), `timed` allows `in SECONDS` */
export interface ActionSpec {
  args: number;
  timed?: boolean;
  opt?: number;
}

export const ACTIONS: Record<string, ActionSpec> = {
  move: { args: 3, timed: true },
  turn: { args: 3, timed: true },
  grow: { args: 1, timed: true },
  home: { args: 0, timed: true },
  pivot: { args: 3 },
  spin: { args: 3 },
  color: { args: 1, opt: 1 },
  glow: { args: 1, opt: 1 },
  opacity: { args: 1, opt: 1 },
  show: { args: 0 },
  hide: { args: 0 },
  say: { args: 1 },
  timer: { args: 1 },
  /** add velocity to a physical object (a ball), m/s */
  push: { args: 3 },
  /** kick a physical object away from someone (by name, usually `who`) at a speed, m/s */
  kick: { args: 2 },
  /** a note: semitones from middle C, and optionally the instrument ("bell", "marimba", "pluck") */
  play: { args: 1, opt: 1 },
};

/** own-property lookup, so names like "toString" are not mistaken for actions */
export function actionSpec(name: string): ActionSpec | undefined {
  return Object.hasOwn(ACTIONS, name) ? ACTIONS[name] : undefined;
}

export const EVENTS = ["start", "touch", "timer", "near", "hear", "bump"] as const;
export type EventName = (typeof EVENTS)[number];

export function isEvent(name: string): name is EventName {
  return (EVENTS as readonly string[]).includes(name);
}

export type Expr =
  | { k: "lit"; v: Val }
  | { k: "var"; n: string; line: number }
  | { k: "call"; n: string; a: Expr[]; line: number }
  | { k: "un"; op: string; e: Expr }
  | { k: "bin"; op: string; a: Expr; b: Expr; line: number };

export type VarStmt = { k: "var"; n: string; e: Expr | null; line: number };
export type SetStmt = { k: "set"; n: string; op: string; e: Expr; line: number };
export type IfStmt = { k: "if"; c: Expr; a: Stmt[]; b: Stmt[] | null; line: number };
export type RepeatStmt = { k: "repeat"; n: Expr; body: Stmt[]; line: number };
export type WhileStmt = { k: "while"; c: Expr; body: Stmt[]; line: number };
export type WaitStmt = { k: "wait"; e: Expr; line: number };
export type StopStmt = { k: "stop"; line: number };
export type ActStmt = { k: "act"; n: string; a: Expr[]; dur: Expr | null; line: number };

export type Stmt = VarStmt | SetStmt | IfStmt | RepeatStmt | WhileStmt | WaitStmt | StopStmt | ActStmt;

export interface Handler {
  ev: EventName;
  arg: Expr | null;
  body: Stmt[];
  line: number;
}

export interface Program {
  globals: Stmt[];
  handlers: Handler[];
}
