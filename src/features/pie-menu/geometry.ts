/**
 * Pie layout, in pixels around the centre: the ring is cut into one wedge per slot (at least six), the first slot
 * straight up. Labels sit on top of their wedge and get narrower near the top and bottom, where wedges are narrow.
 */
export const INNER_RADIUS = 34;
const OUTER_RADIUS = 136;
const OUTER_RADIUS_BIG = 152;
/** more items than this make the big pie */
const BIG_AFTER = 8;
const MIN_SLOTS = 6;
/** a hair of space between wedges, in radians */
const WEDGE_GAP = 0.012;
const LABEL_OUT = 8;
const LABEL_MIN_PX = 58;
const LABEL_MAX_PX = 112;
const LABEL_PAD_PX = 6;
/** below this |sin| a label is treated as lying across the wedge, not along it */
const MIN_SIN = 0.35;
/** room kept around the pie inside the stage */
const SIDE_ROOM = 50;
const BOTTOM_ROOM = 34;
const EDGE = 4;

export const isBig = (count: number): boolean => count > BIG_AFTER;
export const outerRadius = (count: number): number => (isBig(count) ? OUTER_RADIUS_BIG : OUTER_RADIUS);
export const slotCount = (count: number): number => Math.max(count, MIN_SLOTS);

const angleOf = (i: number, slots: number): number => -Math.PI / 2 + (i * Math.PI * 2) / slots;
const point = (r: number, a: number): string => `${(Math.cos(a) * r).toFixed(1)} ${(Math.sin(a) * r).toFixed(1)}`;

/** SVG path of wedge `i`: outer arc clockwise, inner arc back */
export function wedgePath(i: number, slots: number, outer: number, inner = INNER_RADIUS): string {
  const step = (Math.PI * 2) / slots;
  const a0 = angleOf(i, slots) - step / 2 + WEDGE_GAP;
  const a1 = angleOf(i, slots) + step / 2 - WEDGE_GAP;
  return (
    `M${point(inner, a0)} L${point(outer, a0)} A${outer} ${outer} 0 0 1 ${point(outer, a1)} ` +
    `L${point(inner, a1)} A${inner} ${inner} 0 0 0 ${point(inner, a0)}Z`
  );
}

export interface LabelBox {
  left: number;
  top: number;
  width: number;
}

/** where label `i` goes and how wide it may be so it stays inside its wedge */
export function labelBox(i: number, slots: number, outer: number, inner = INNER_RADIUS): LabelBox {
  const step = (Math.PI * 2) / slots;
  const a = angleOf(i, slots);
  const r = (inner + outer) / 2 + LABEL_OUT;
  const chord = 2 * r * Math.sin(step / 2) - LABEL_PAD_PX;
  const width = Math.round(
    Math.max(LABEL_MIN_PX, Math.min(LABEL_MAX_PX, chord / Math.max(MIN_SIN, Math.abs(Math.sin(a))))),
  );
  return { left: +(Math.cos(a) * r).toFixed(1), top: +(Math.sin(a) * r).toFixed(1), width };
}

export interface Size {
  width: number;
  height: number;
}

/** the pie's centre inside the stage: as close to the click as fits */
export function pieCentre(x: number, y: number, stage: Size, count: number): { left: number; top: number } {
  const pad = outerRadius(count) + EDGE;
  return {
    left: Math.min(Math.max(x, pad + SIDE_ROOM), stage.width - pad - SIDE_ROOM),
    top: Math.min(Math.max(y, pad), stage.height - pad - BOTTOM_ROOM),
  };
}
