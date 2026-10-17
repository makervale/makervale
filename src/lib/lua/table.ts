/** Lua's values, and its one data structure: the table. */
import type { FuncBody } from "./ast";
import { fail } from "./errors";

export interface Wait {
  wait: number;
}
export type Gen<T> = Generator<Wait, T, void>;

/** what a running piece of Lua has at hand; one per thread */
export interface Ctx {
  /** work done since the runtime last looked; loops wait a moment once it grows past a frame's worth */
  steps: number;
  globals: LuaTable;
  /** the scopes now in use, innermost last (for measuring how much the script holds) */
  stack: Scope[];
  depth: number;
  print(text: string): void;
  random(): number;
}

export type NativeFn = (args: Value[], c: Ctx, line: number) => Value[] | Gen<Value[]>;

/** a function written in Lua, with the scope it was made in */
export class Closure {
  constructor(
    readonly f: FuncBody,
    readonly scope: Scope,
  ) {}
}

/** a function the host provides */
export class Native {
  constructor(
    readonly name: string,
    readonly fn: NativeFn,
  ) {}
}

export type Value = undefined | boolean | number | string | LuaTable | Closure | Native;

/** the local variables of one block; a closure keeps its scope (and the ones around it) alive */
export class Scope {
  readonly vars = new Map<string, Value>();
  constructor(readonly parent: Scope | null) {}

  /** the scope that has this name, if any */
  find(name: string): Scope | null {
    for (let s: Scope | null = this; s; s = s.parent) if (s.vars.has(name)) return s;
    return null;
  }
}

let tables = 0;

export class LuaTable {
  readonly id = ++tables;
  private readonly map = new Map<unknown, Value>();
  /** 1…border are all set: the length, kept as entries come and go */
  private border = 0;

  get(k: Value): Value {
    return this.map.get(k === 0 ? 0 : k);
  }

  set(k: Value, v: Value, line = 0): void {
    if (k === undefined) fail("a table key can't be nil", line);
    if (typeof k === "number" && isNaN(k)) fail("a table key can't be NaN", line);
    const key = k === 0 ? 0 : k;
    if (v === undefined) {
      this.map.delete(key);
      if (typeof key === "number" && key >= 1 && key <= this.border) this.border = key - 1;
      return;
    }
    this.map.set(key, v);
    if (key === this.border + 1) while (this.map.has(this.border + 1)) this.border++;
  }

  get length(): number {
    return this.border;
  }

  get size(): number {
    return this.map.size;
  }

  entries(): IterableIterator<[unknown, Value]> {
    return this.map.entries();
  }

  /** in pairs() order: the order the keys were added */
  keys(): unknown[] {
    return [...this.map.keys()];
  }

  clear(): void {
    this.map.clear();
    this.border = 0;
  }
}

export const isFn = (v: Value): v is Closure | Native => v instanceof Closure || v instanceof Native;
