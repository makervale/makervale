/**
 * Which hits count as a bump. Two kinds: the moment a body starts touching something (however gently: a ball rolling
 * into a goal), and a real knock against something it was already touching (a bounce). Never the steady pressure of
 * resting on a floor, and one bump per pair now and then.
 */
import type { Hit } from "@/lib/physics";

/** a knock at least this hard counts even while already touching */
const KNOCK_SPEED_M_S = 1;
const SAME_PAIR_EVERY_S = 0.4;

export interface Bump {
  id: string;
  by: string;
  speed: number;
}

/** a filter with memory: give it a body's hits each step, it hands back the bumps worth telling */
export function bumpsOf(): (body: string, hits: Hit[], now: number) => Bump[] {
  const last = new Map<string, number>();
  const touching = new Map<string, Set<string>>();
  return (body, hits, now) => {
    const before = touching.get(body) ?? new Set<string>();
    const after = new Set(hits.map((h) => h.id ?? "ground"));
    touching.set(body, after);
    const out: Bump[] = [];
    for (const h of hits) {
      const other = h.id ?? "ground";
      const starts = !before.has(other);
      if (!starts && h.speed < KNOCK_SPEED_M_S) continue;
      const key = body + "|" + other;
      if (now - (last.get(key) ?? -Infinity) < SAME_PAIR_EVERY_S) continue;
      last.set(key, now);
      // the object struck hears it, and so does the body (a ball's own script can react)
      if (h.id) out.push({ id: h.id, by: body, speed: h.speed });
      out.push({ id: body, by: other, speed: h.speed });
    }
    return out;
  };
}
