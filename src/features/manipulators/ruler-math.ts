/** The numbers behind the rulers: how finely a ruler is divided at this zoom, and where its ticks go. */

/** ticks closer than this on screen are merged into coarser steps, pixels */
const TICK_SPACING_PX = 14;
const MIN_SUBDIVISIONS = 1 / 4;
const MAX_SUBDIVISIONS = 256;
/** more ticks than this are not drawn at all */
const MAX_TICKS = 400;
const TICK_PX = { major: 12, odd: 5, even: 8 };

/**
 * Steps per grid unit along an axis: a power of two, so steps line up with the grid. `projected` is how much of the
 * axis faces the viewer (|axis × view|), `metresPerPixel` the zoom at the point.
 */
export function rulerSubdivisions(projected: number, metresPerPixel: number, grid: number): number {
  const pixelsPerGrid = (Math.max(0.1, projected) / metresPerPixel) * grid;
  const steps = Math.pow(2, Math.floor(Math.log2(Math.max(1e-6, pixelsPerGrid / TICK_SPACING_PX))));
  return Math.min(MAX_SUBDIVISIONS, Math.max(MIN_SUBDIVISIONS, steps));
}

export interface Tick {
  /** metres from the ruler's origin along the axis */
  along: number;
  /** tick length in pixels: whole grid units are longest */
  px: number;
}

/** the ticks within `half` metres either side of `base` (the origin's coordinate along the axis) */
export function rulerTicks(base: number, half: number, unit: number, grid: number): Tick[] {
  const k0 = Math.ceil((base - half) / unit);
  const k1 = Math.floor((base + half) / unit);
  if (k1 - k0 >= MAX_TICKS) return [];
  const out: Tick[] = [];
  for (let k = k0; k <= k1; k++) {
    const v = k * unit;
    const major = Math.abs(v - Math.round(v / grid) * grid) < 1e-6;
    const odd = Math.abs((v / unit) % 2) > 0.5;
    out.push({ along: v - base, px: tickLength(major, odd) });
  }
  return out;
}

function tickLength(major: boolean, odd: boolean): number {
  if (major) return TICK_PX.major;
  return odd ? TICK_PX.odd : TICK_PX.even;
}

/** snap a value to the nearest multiple of `unit` */
export const snapTo = (v: number, unit: number): number => Math.round(v / unit) * unit;
