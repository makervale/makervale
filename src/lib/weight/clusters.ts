/** Places where the sand lies high, grouped into clusters of windows that touch (face, edge or corner). */
import { key, unkey } from "./cells";

const NEIGHBOURS: [number, number, number][] = [];
for (let n = 0; n < 27; n++)
  if (n !== 13) NEIGHBOURS.push([(n % 3) - 1, (Math.floor(n / 3) % 3) - 1, Math.floor(n / 9) - 1]);

/** everything in `left` that touches the seed, through others in `left`; taken out of `left` */
function grow(seed: number, left: Set<number>): number[] {
  const group = [seed];
  for (let i = 0; i < group.length; i++) {
    const [x, y, z] = unkey(group[i]);
    for (const [dx, dy, dz] of NEIGHBOURS) {
      const k = key(x + dx, y + dy, z + dz);
      if (left.delete(k)) group.push(k);
    }
  }
  return group;
}

/** the windows (by key) filled at least `from`, as groups that touch */
export function clustersOf(fills: Map<number, number>, from: number): number[][] {
  const left = new Set([...fills].filter(([, f]) => f >= from).map(([k]) => k));
  const out: number[][] = [];
  for (const seed of left) {
    left.delete(seed);
    out.push(grow(seed, left));
  }
  return out;
}
