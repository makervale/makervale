/** Joining two polygons along a shared edge. */

const rotateTo = (face: number[], start: number): number[] => {
  const i = face.indexOf(start);
  return [...face.slice(i), ...face.slice(0, i)];
};

/** remove one "x, y, x" spike (a back-and-forth left by a longer shared chain); false when there is none */
function stripOneSpike(q: number[]): boolean {
  const len = q.length;
  for (let i = 0; i < len; i++) {
    if (q[(i + len - 1) % len] !== q[(i + 1) % len]) continue;
    const after = (i + 1) % len;
    // remove the higher index first so the other stays put
    q.splice(Math.max(i, after), 1);
    q.splice(Math.min(i, after), 1);
    return true;
  }
  return false;
}

/**
 * The polygon left when faces F (running a→b) and G (running b→a) lose their shared edge.
 * Null when the result would pinch through a vertex twice or collapse.
 */
export function mergeAcross(faceF: number[], faceG: number[], a: number, b: number): number[] | null {
  // b … a, then a … b with the shared ends dropped
  const q = [...rotateTo(faceF, b), ...rotateTo(faceG, a).slice(1, -1)];
  while (q.length >= 3 && stripOneSpike(q));
  if (q.length < 3 || new Set(q).size !== q.length) return null;
  return q;
}
