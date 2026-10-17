/**
 * The sand as smooth shells, for the sand map: the fill of the windows sampled finer than the cells (eased between
 * cell centres, so there are no steps), then the surface where it crosses a level, by surface nets (one vertex
 * per crossed sample cube, at the mean of its edge crossings; one quad per crossed sample edge).
 */
import type { Vec3 } from "@/lib/vec";
import { CELL_M, key, unkey } from "./cells";
import { clustersOf } from "./clusters";
import type { Ledger } from "./ledger";

export interface Field {
  /** metres, the first sample */
  lo: Vec3;
  /** metres between samples */
  step: number;
  dims: [number, number, number];
  at: Float32Array;
}

export interface Surface {
  positions: number[];
  indices: number[];
}

const ease = (t: number) => t * t * (3 - 2 * t);

interface CellGrid {
  lo: Vec3;
  dims: Vec3;
  at: Float32Array;
}

/** the windows' fills over a cluster's box, one cell wider on every side so every shell closes */
function cellGrid(cluster: number[], fills: Map<number, number>): CellGrid {
  const cells = cluster.map(unkey);
  const lo = [0, 1, 2].map((i) => cells.reduce((m, c) => Math.min(m, c[i]), Infinity) - 1) as Vec3;
  const hi = [0, 1, 2].map((i) => cells.reduce((m, c) => Math.max(m, c[i]), -Infinity) + 1);
  const dims = [0, 1, 2].map((i) => hi[i] - lo[i] + 1) as Vec3;
  const at = new Float32Array(dims[0] * dims[1] * dims[2]);
  for (let n = 0; n < at.length; n++) {
    const [x, y, z] = [n % dims[0], Math.floor(n / dims[0]) % dims[1], Math.floor(n / (dims[0] * dims[1]))];
    at[n] = fills.get(key(lo[0] + x, lo[1] + y, lo[2] + z)) ?? 0;
  }
  return { lo, dims, at };
}

/** the fill at a point given in cells from the grid's corner, eased between the cell centres */
function sampleCells(g: CellGrid, p: Vec3): number {
  const [nx, ny, nz] = g.dims;
  const u = p.map((x, i) => Math.min(g.dims[i] - 1, Math.max(0, x - 0.5)));
  const base = u.map(Math.floor);
  const w = u.map((x, i) => ease(x - base[i]));
  let s = 0;
  for (let c = 0; c < 8; c++) {
    const bit = [c & 1, (c >> 1) & 1, (c >> 2) & 1];
    const [x, y, z] = bit.map((b, i) => Math.min([nx, ny, nz][i] - 1, base[i] + b));
    const weight = bit.reduce((m, b, i) => m * (b ? w[i] : 1 - w[i]), 1);
    s += weight * g.at[z * nx * ny + y * nx + x];
  }
  return s;
}

/** a cluster's fill (1 = at the limit) sampled `perCell` times per cell along each axis */
function fieldOf(g: CellGrid, perCell: number): Field {
  const dims = g.dims.map((n) => n * perCell + 1) as [number, number, number];
  const at = new Float32Array(dims[0] * dims[1] * dims[2]);
  for (let n = 0; n < at.length; n++) {
    const p = [n % dims[0], Math.floor(n / dims[0]) % dims[1], Math.floor(n / (dims[0] * dims[1]))];
    at[n] = sampleCells(g, p.map((x) => x / perCell) as Vec3);
  }
  return { lo: g.lo.map((x) => x * CELL_M) as Vec3, step: CELL_M / perCell, dims, at };
}

/** samples a field may have; finer sampling first gives way, then a cluster too big to draw is left out */
const MAX_SAMPLES = 2_000_000;

/**
 * The sand's fill round every place filled at least `from`, one field per cluster: places far apart never make one
 * huge grid between them, however far apart they are.
 */
export function fieldsOf(ledger: Ledger, from: number): Field[] {
  const fills = new Map<number, number>();
  for (const [[x, y, z], fill] of ledger.windowFill()) fills.set(key(x, y, z), fill);
  const out: Field[] = [];
  for (const cluster of clustersOf(fills, from)) {
    const g = cellGrid(cluster, fills);
    const cells = g.dims[0] * g.dims[1] * g.dims[2];
    if (cells * 9 <= MAX_SAMPLES) out.push(fieldOf(g, 2));
    else if (cells * 2 <= MAX_SAMPLES) out.push(fieldOf(g, 1));
  }
  return out;
}

/** the corner pairs along the 12 edges of a cube; corner c sits at (c&1, c>>1&1, c>>2&1) */
const EDGES: [number, number][] = [];
for (let c = 0; c < 8; c++) for (const bit of [1, 2, 4]) if (!(c & bit)) EDGES.push([c, c | bit]);
const corner = (c: number): Vec3 => [c & 1, (c >> 1) & 1, (c >> 2) & 1];

/** where the surface crosses this sample cube: the mean of its edge crossings, or null if it doesn't */
function cubeVertex(f: Field, i: number, j: number, k: number, level: number): Vec3 | null {
  const [nx, ny] = f.dims;
  const v = [0, 1, 2, 3, 4, 5, 6, 7].map((c) => {
    const [a, b, d] = corner(c);
    return f.at[(k + d) * nx * ny + (j + b) * nx + i + a];
  });
  const sum: Vec3 = [0, 0, 0];
  let n = 0;
  for (const [a, b] of EDGES) {
    if (v[a] > level === v[b] > level) continue;
    const t = (level - v[a]) / (v[b] - v[a]);
    const [pa, pb] = [corner(a), corner(b)];
    for (let x = 0; x < 3; x++) sum[x] += pa[x] + (pb[x] - pa[x]) * t;
    n++;
  }
  if (!n) return null;
  return [0, 1, 2].map((x) => f.lo[x] + ([i, j, k][x] + sum[x] / n) * f.step) as Vec3;
}

/** the closed surface where the field crosses `level`, wound so its faces look out of the inside */
export function isoSurface(f: Field, level: number): Surface {
  const [nx, ny, nz] = f.dims;
  const cubes = [nx - 1, ny - 1, nz - 1];
  const vertexOf = new Int32Array(cubes[0] * cubes[1] * cubes[2]).fill(-1);
  const out: Surface = { positions: [], indices: [] };
  for (let n = 0; n < vertexOf.length; n++) {
    const [i, j, k] = [n % cubes[0], Math.floor(n / cubes[0]) % cubes[1], Math.floor(n / (cubes[0] * cubes[1]))];
    const p = cubeVertex(f, i, j, k, level);
    if (!p) continue;
    vertexOf[n] = out.positions.length / 3;
    out.positions.push(...p);
  }
  for (let axis = 0; axis < 3; axis++) quadsAlong(f, level, axis, vertexOf, out.indices);
  return out;
}

/** a quad round every sample edge along `axis` that the surface crosses, joining the four cubes that share it */
function quadsAlong(f: Field, level: number, axis: number, vertexOf: Int32Array, indices: number[]): void {
  const [nx, ny] = f.dims;
  const [b, c] = [(axis + 1) % 3, (axis + 2) % 3];
  const cube = (p: number[]) => vertexOf[p[2] * (nx - 1) * (ny - 1) + p[1] * (nx - 1) + p[0]];
  for (let n = 0; n < f.at.length; n++) {
    const p = [n % nx, Math.floor(n / nx) % ny, Math.floor(n / (nx * ny))];
    if (p[axis] >= f.dims[axis] - 1 || p[b] < 1 || p[c] < 1 || p[b] >= f.dims[b] - 1 || p[c] >= f.dims[c] - 1) continue;
    const q = [...p];
    q[axis]++;
    const inside = f.at[n] > level;
    if (inside === f.at[q[2] * nx * ny + q[1] * nx + q[0]] > level) continue;
    const around = [
      [0, 0],
      [-1, 0],
      [-1, -1],
      [0, -1],
    ].map(([db, dc]) => {
      const r = [...p];
      r[b] += db;
      r[c] += dc;
      return cube(r);
    });
    if (around.some((x) => x < 0)) continue;
    const [v0, v1, v2, v3] = inside ? around : [...around].reverse();
    indices.push(v0, v1, v2, v0, v2, v3);
  }
}
