/**
 * The sand ledger: how much weight lies around every place, kept up to date as the scene changes, and whether a
 * change would pile it higher than the limit anywhere (or the room past its ceiling). Sums are kept for the window
 * around each cell (the cell and REACH cells on every side), so checking a change only touches the windows near
 * it, whatever the size of the scene. Objects spread over very many cells lie too thin to keep cell by cell; they
 * are a "wide" layer, added to a window by how much of them it covers.
 */
import type { CellBox, Spread } from "./cells";
import { MAX_CELLS, REACH, cellBox, cellCount, key, overlap, spread, unkey } from "./cells";
import type { Shape } from "./weigh";
import { weightOf, worldBox } from "./weigh";

export const SAND_LIMIT = 45_000;
export const ROOM_CEILING = 300_000;

/** how much of the room's ceiling a scene takes, in whole percent: what lists show before anyone comes in */
export function fillOf(objects: Iterable<Shape>): number {
  let total = 0;
  for (const o of objects) total += weightOf(o);
  return Math.min(100, Math.ceil((total * 100) / ROOM_CEILING));
}

export interface Entry {
  weight: number;
  box: CellBox;
  /** null for a wide object */
  spread: Spread | null;
}

export type Verdict =
  | { ok: true }
  | { ok: false; why: "dense"; at: [number, number, number] }
  | { ok: false; why: "full" };

export interface Proposal {
  next: Map<string, Entry | null>;
  cellDelta: Map<number, number>;
  wideIn: Entry[];
  wideOut: Entry[];
  totalDelta: number;
}

export function entryOf(o: Shape): Entry {
  const weight = weightOf(o);
  const box = cellBox(worldBox(o));
  return { weight, box, spread: cellCount(box) > MAX_CELLS ? null : spread(weight, box) };
}

export const wideShare = (e: Entry, k: number): number => {
  const [x, y, z] = unkey(k);
  return Math.floor((e.weight * overlap(e.box, x, y, z)) / cellCount(e.box));
};

export function addSpread(into: Map<number, number>, s: Spread, sign: number): void {
  s.keys.forEach((k, i) => into.set(k, (into.get(k) ?? 0) + sign * s.amounts[i]));
}

export function forWindowsAround(k: number, fn: (w: number) => void): void {
  const [x, y, z] = unkey(k);
  for (let dx = -REACH; dx <= REACH; dx++) {
    for (let dy = -REACH; dy <= REACH; dy++) {
      for (let dz = -REACH; dz <= REACH; dz++) fn(key(x + dx, y + dy, z + dz));
    }
  }
}
