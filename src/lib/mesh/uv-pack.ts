/** Shelf packing of chart rectangles into the unit square. */
export interface ChartRect {
  w: number;
  h: number;
  faces: number[];
  /** placed position, in chart units (before the final scale) */
  x: number;
  y: number;
}

/** lay rectangles in rows `width` wide; returns the extent (the larger side) of the layout */
function shelve(rects: ChartRect[], width: number, pad: number, place: boolean): number {
  let x = pad;
  let y = pad;
  let rowHeight = 0;
  let extentW = 0;
  for (const r of rects) {
    if (x > pad && x + r.w + pad > width) {
      y += rowHeight + pad;
      x = pad;
      rowHeight = 0;
    }
    if (place) {
      r.x = x;
      r.y = y;
    }
    x += r.w + pad;
    extentW = Math.max(extentW, x);
    rowHeight = Math.max(rowHeight, r.h);
  }
  return Math.max(extentW, y + rowHeight + pad);
}

/** try several shelf widths, place with the squarest, return its extent */
function packWithPadding(rects: ChartRect[], pad: number): number {
  let area = 0;
  let maxW = 0;
  for (const r of rects) {
    area += (r.w + pad) * (r.h + pad);
    maxW = Math.max(maxW, r.w);
  }
  let bestW = 0;
  let bestExtent = Infinity;
  for (let k = 0.7; k <= 2.0001; k += 0.05) {
    const width = Math.max(Math.sqrt(area) * k, maxW + 2 * pad);
    const extent = shelve(rects, width, pad, false);
    if (extent < bestExtent) {
      bestExtent = extent;
      bestW = width;
    }
  }
  shelve(rects, bestW, pad, true);
  return bestExtent;
}

const MAX_ROUNDS = 40;

/**
 * Place the rectangles (tallest first) and return the scale that maps the layout into [0, 1]².
 * The gap is fixed in UV space, so scale and padding are iterated until the layout fits.
 */
export function packCharts(rects: ChartRect[], margin: number): number {
  rects.sort((a, b) => b.h - a.h || b.w - a.w);
  let total = 0;
  for (const r of rects) total += r.w * r.h;
  let s = 1 / (Math.sqrt(total) * 1.2 || 1);
  let extent = 0;
  // converges from above; stepping slightly under the fixed point guarantees gaps ≥ margin
  for (let round = 0; round < MAX_ROUNDS; round++) {
    extent = packWithPadding(rects, margin / s);
    const next = 1 / extent;
    if (next >= s) {
      s = next;
      break;
    }
    s = next * 0.995;
  }
  return extent * s > 1 ? 1 / extent : s;
}
