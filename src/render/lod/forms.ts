/** The forms an object can be drawn in, coarsest last, and when to move between them without flicker. */
export type Form = "full" | "simple" | "box" | "gone";

const RANK: Record<Form, number> = { full: 0, simple: 1, box: 2, gone: 3 };
/** going coarser takes this much more room than coming back: no back and forth at a boundary */
export const MARGIN = 0.8;
/** a form stays at least this long before the object goes coarser again, s */
const DWELL_S = 0.6;

/**
 * The form to draw now. `lenient` is the coarsest allowed, `strict` the coarsest allowed with the margin. Finer
 * comes at once (quality first); coarser only past the margin, and not again right after a change.
 */
export function nextForm(now: Form, lenient: Form, strict: Form, sinceChangeS: number): Form {
  if (RANK[lenient] < RANK[now]) return lenient;
  if (RANK[strict] > RANK[now] && sinceChangeS >= DWELL_S) return strict;
  return now;
}
