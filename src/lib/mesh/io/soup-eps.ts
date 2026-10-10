import { boundsOfFlat, diagonalOf } from "../bounds";

/** weld tolerance relative to a triangle soup's size: float32 files are good to ~1e-6 of their extent */
export function soupEps(pos: ArrayLike<number>): number {
  const d = diagonalOf(boundsOfFlat(pos));
  return isFinite(d) && d > 0 ? Math.max(d * 1e-6, 1e-9) : 1e-9;
}
