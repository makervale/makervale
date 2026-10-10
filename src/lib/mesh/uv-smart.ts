import type { Vec3 } from "../vec";
import { add, dot, normalize, scale } from "../vec";
import type { Mesh, UV } from "./mesh";
import { scaledPositions } from "./scaled";
import { topologyOf } from "./topology";
import { chartBasis, layFlat, projectOnto } from "./uv-flatten";
import type { ChartRect } from "./uv-pack";
import { packCharts } from "./uv-pack";
import { polygonFrame } from "./uv-project";

/** faces smaller than this have no reliable normal */
const MIN_AREA = 1e-14;
const MAX_DIRECTIONS = 256;

interface FaceFrame {
  n: Vec3;
  area: number;
}

interface Directions {
  dirs: Vec3[];
  /** per face: the direction that serves it best */
  assign: Int32Array;
}

/** the live face least well served so far (larger faces first on ties) */
function worstServed(live: number[], best: Float64Array, fd: FaceFrame[]): number {
  let pick = live[0];
  for (const i of live) if (best[i] < best[pick] || (best[i] === best[pick] && fd[i].area > fd[pick].area)) pick = i;
  return pick;
}

/** the area-weighted mean normal of the seed's angular neighbourhood (or the seed's own normal) */
function directionAround(seed: Vec3, live: number[], best: Float64Array, fd: FaceFrame[], minCos: number): Vec3 {
  let sum: Vec3 = [0, 0, 0];
  for (const i of live) {
    const d = dot(fd[i].n, seed);
    if (d >= minCos && d > best[i]) sum = add(sum, scale(fd[i].n, fd[i].area));
  }
  const d = normalize(sum);
  const degenerate = !(Math.abs(d[0]) + Math.abs(d[1]) + Math.abs(d[2]));
  return dot(d, seed) < minCos || degenerate ? seed : d;
}

/** projection directions: repeatedly take the face worst served so far and serve its neighbourhood */
function projectionDirections(fd: FaceFrame[], live: number[], minCos: number): Directions {
  const dirs: Vec3[] = [];
  const best = new Float64Array(fd.length).fill(-2);
  const assign = new Int32Array(fd.length);
  for (let it = 0; it < MAX_DIRECTIONS; it++) {
    const pick = worstServed(live, best, fd);
    if (dirs.length && best[pick] >= minCos) break;
    const d = directionAround(fd[pick].n, live, best, fd, minCos);
    dirs.push(d);
    fd.forEach((f, i) => {
      const v = dot(f.n, d);
      if (v <= best[i]) return;
      best[i] = v;
      assign[i] = dirs.length - 1;
    });
  }
  return { dirs, assign };
}

/** charts: faces joined across edges flatter than the limit when they share a direction */
function chartsOf(m: Mesh, fd: FaceFrame[], assign: Int32Array, minCos: number): number[][] {
  const parent = m.f.map((_, i) => i);
  const find = (i: number): number => (parent[i] === i ? i : (parent[i] = find(parent[i])));
  for (const e of topologyOf(m).edges.values()) {
    for (let k = 1; k < e.faces.length; k++) {
      const [a, b] = [e.faces[k - 1], e.faces[k]];
      if (assign[a] !== assign[b] || dot(fd[a].n, fd[b].n) < minCos) continue;
      const [ra, rb] = [find(a), find(b)];
      if (ra !== rb) parent[ra] = rb;
    }
  }
  const charts = new Map<number, number[]>();
  m.f.forEach((_, i) => {
    const r = find(i);
    if (charts.has(r)) charts.get(r)!.push(i);
    else charts.set(r, [i]);
  });
  return [...charts.values()];
}

/** the chart's mean normal, unless some face turns away from it: then its projection direction */
function chartNormal(faces: number[], fd: FaceFrame[], fallback: Vec3): Vec3 {
  let sum: Vec3 = [0, 0, 0];
  for (const f of faces) sum = add(sum, scale(fd[f].n, fd[f].area));
  const n = normalize(sum);
  const turnsAway = faces.some((f) => fd[f].area > MIN_AREA && dot(fd[f].n, n) < 0.05);
  return turnsAway || !(sum[0] || sum[1] || sum[2]) ? fallback : n;
}

/**
 * "Smart project": group faces into charts by normal direction, project each chart flat, turn it to
 * its minimal-area rectangle and shelf-pack all charts into [0, 1]² with `margin` gaps.
 * Returns the chart count.
 */
export function smartUV(m: Mesh, size: Vec3 = [1, 1, 1], angleDeg = 66, margin = 0.01): number {
  const P = scaledPositions(m, size);
  const fd = m.f.map((face) => polygonFrame(P, face));
  const minCos = Math.cos((angleDeg * Math.PI) / 180);
  const live = m.f.map((_, i) => i).filter((i) => fd[i].area > MIN_AREA);
  if (!live.length) {
    m.uv = m.f.map((face) => face.map((): UV => [0, 0]));
    return 0;
  }
  const { dirs, assign } = projectionDirections(fd, live, minCos);
  const local: UV[][] = new Array(m.f.length);
  const rects: ChartRect[] = chartsOf(m, fd, assign, minCos).map((faces) => {
    const basis = chartBasis(chartNormal(faces, fd, dirs[assign[faces[0]]]));
    for (const f of faces) local[f] = m.f[f].map((i) => projectOnto(P[i], basis));
    return { ...layFlat(faces.flatMap((f) => local[f])), faces, x: 0, y: 0 };
  });
  const s = packCharts(rects, margin);
  m.uv = new Array(m.f.length);
  for (const r of rects)
    for (const f of r.faces) m.uv[f] = local[f].map((p): UV => [(r.x + p[0]) * s, (r.y + p[1]) * s]);
  return rects.length;
}
