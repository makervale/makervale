/** How much a script holds: everything reachable from its globals and its running threads, in rough cells. */
import type { Value } from "./table";
import { Closure, LuaTable, Scope } from "./table";

type Item = Value | Scope | unknown;

/** counts up to `limit` (and a little past it), then stops: only whether a script holds too much matters */
export function measure(roots: Item[], limit: number): number {
  let n = 0;
  const seen = new Set<object>();
  const todo: Item[] = [...roots];
  while (todo.length && n <= limit) {
    const v = todo.pop();
    if (typeof v === "string") n += 1 + (v.length >> 5);
    if (!(v instanceof Object) || seen.has(v)) continue;
    seen.add(v);
    n++;
    if (v instanceof LuaTable) {
      for (const [k, x] of v.entries()) todo.push(k, x);
      n += v.size;
      if (v.meta) todo.push(v.meta);
    } else if (v instanceof Closure) todo.push(v.scope);
    else if (v instanceof Scope) {
      todo.push(...v.vars.values(), ...(v.varargs ?? []), v.parent);
      n += v.vars.size;
    }
  }
  return n;
}
