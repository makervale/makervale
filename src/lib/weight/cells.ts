/**
 * Space as cells of CELL_M metres, and how an object's weight lies in them: spread evenly over the cells its box
 * covers, like sand poured over its footprint. Integer amounts, with the remainder going to the first cells in a
 * fixed order, so every browser spreads it the same way.
 */
import type { Box } from "./weigh";

export const CELL_M = 4;
/** cells this far (in cells) from a cell share its sand: the window is (2·REACH+1) cells on each side */
export const REACH = 2;
/** an object over more cells than this lies too thin to matter cell by cell: it is kept as a "wide" layer */
export const MAX_CELLS = 2048;
const SPAN = 1 << 16;
const HALF = SPAN / 2;

export type CellBox = { lo: [number, number, number]; hi: [number, number, number] };

const clampCell = (c: number) => Math.max(-HALF + REACH + 1, Math.min(HALF - REACH - 2, c));

export const cellOf = (x: number): number => clampCell(Math.floor(x / CELL_M));

export function cellBox(b: Box): CellBox {
  return {
    lo: [cellOf(b.lo[0]), cellOf(b.lo[1]), cellOf(b.lo[2])],
    hi: [cellOf(b.hi[0]), cellOf(b.hi[1]), cellOf(b.hi[2])],
  };
}

export const cellCount = (c: CellBox): number =>
  (c.hi[0] - c.lo[0] + 1) * (c.hi[1] - c.lo[1] + 1) * (c.hi[2] - c.lo[2] + 1);

/** one number per cell, exact in a double: 16 bits per axis */
export const key = (x: number, y: number, z: number): number => ((x + HALF) * SPAN + (y + HALF)) * SPAN + (z + HALF);

export function unkey(k: number): [number, number, number] {
  const z = (k % SPAN) - HALF;
  const rest = Math.floor(k / SPAN);
  return [Math.floor(rest / SPAN) - HALF, (rest % SPAN) - HALF, z];
}

/** where an object's weight lies: cell keys and the amount in each */
export interface Spread {
  keys: number[];
  amounts: number[];
}

export function spread(weight: number, c: CellBox): Spread {
  const n = cellCount(c);
  const base = Math.floor(weight / n);
  let extra = weight - base * n;
  const out: Spread = { keys: [], amounts: [] };
  const [nx, ny, nz] = [0, 1, 2].map((i) => c.hi[i] - c.lo[i] + 1);
  for (let i = 0; i < n; i++) {
    const amount = base + (extra > 0 ? 1 : 0);
    if (extra > 0) extra--;
    if (!amount) continue;
    const z = i % nz;
    const y = Math.floor(i / nz) % ny;
    const x = Math.floor(i / (nz * ny)) % nx;
    out.keys.push(key(c.lo[0] + x, c.lo[1] + y, c.lo[2] + z));
    out.amounts.push(amount);
  }
  return out;
}

/** how many of a wide object's cells fall in the window around cell (x, y, z) */
export function overlap(c: CellBox, x: number, y: number, z: number): number {
  let n = 1;
  const at = [x, y, z];
  for (let i = 0; i < 3; i++) {
    const lo = Math.max(c.lo[i], at[i] - REACH);
    const hi = Math.min(c.hi[i], at[i] + REACH);
    if (hi < lo) return 0;
    n *= hi - lo + 1;
  }
  return n;
}
