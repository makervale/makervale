import type { Mesh } from "./mesh";
import { edgeDirection, topologyOf } from "./topology";

/** Open border edges, followed in the direction their one face runs them, joined into chains. */

/** border edges among `keys` as a map start → end; throws when two of them leave the same vertex */
export function borderSuccessors(m: Mesh, keys: Iterable<string>): Map<number, number> {
  const t = topologyOf(m);
  const next = new Map<number, number>();
  for (const k of keys) {
    const e = t.edges.get(k);
    if (!e || e.faces.length !== 1) continue;
    const [a, b] = edgeDirection(m, e);
    if (next.has(a)) throw new Error("The edges branch: select two separate loops");
    next.set(a, b);
  }
  return next;
}

export interface Chain {
  /** vertices in face direction */
  verts: number[];
  closed: boolean;
}

function follow(next: Map<number, number>, start: number, seen: Set<number>): Chain {
  const verts = [start];
  seen.add(start);
  let cur = start;
  while (next.has(cur)) {
    const n = next.get(cur)!;
    if (n === start) return { verts, closed: true };
    if (seen.has(n)) break;
    verts.push(n);
    seen.add(n);
    cur = n;
  }
  return { verts, closed: false };
}

/** split successor links into chains, open chains (those with a start nothing leads to) first */
export function chainsOf(next: Map<number, number>): Chain[] {
  const leadsTo = new Set(next.values());
  const openStarts = [...next.keys()].filter((a) => !leadsTo.has(a));
  const seen = new Set<number>();
  const out: Chain[] = [];
  for (const s of [...openStarts, ...next.keys()]) if (!seen.has(s)) out.push(follow(next, s, seen));
  return out;
}

/** closed loops only, from successor links (used to cap holes) */
export function closedLoops(next: Map<number, number>): number[][] {
  const seen = new Set<number>();
  const out: number[][] = [];
  for (const s of next.keys()) {
    if (seen.has(s)) continue;
    const chain = follow(next, s, seen);
    if (chain.closed) out.push(chain.verts);
  }
  return out;
}
