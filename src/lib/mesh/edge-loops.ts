import type { Mesh } from "./mesh";
import { edgeKey, parseEdgeKey } from "./mesh";
import type { Topology } from "./topology";
import { topologyOf } from "./topology";

/** Edge loops (the row an edge belongs to) and edge rings (the strip of quads it crosses). */
const MAX_WALK = 100000;

/** the next half-edge straight ahead through a 4-valent interior vertex, or -1 */
function loopStep(t: Topology, h: number): number {
  const b = t.dest(h);
  if (t.vertNbrs[b].length !== 4 || t.isBoundaryVert(b)) return -1;
  const twin = t.heTwin[t.next(h)];
  return twin < 0 ? -1 : t.next(twin);
}

/** along an open border, stopping where more than two border edges meet */
function boundaryLoop(t: Topology, key: string): Set<string> {
  const out = new Set<string>([key]);
  const stack = [...parseEdgeKey(key)];
  while (stack.length) {
    const v = stack.pop()!;
    const borders = t.vertNbrs[v].filter((n) => t.isBoundaryEdge(v, n));
    if (borders.length !== 2) continue;
    for (const n of borders) {
      const k = edgeKey(v, n);
      if (out.has(k)) continue;
      out.add(k);
      stack.push(n);
    }
  }
  return out;
}

function walkLoop(t: Topology, start: number, out: Set<string>): void {
  let h = start;
  for (let guard = 0; guard < MAX_WALK; guard++) {
    h = loopStep(t, h);
    if (h < 0) return;
    const k = edgeKey(t.heVert[h], t.dest(h));
    if (out.has(k)) return;
    out.add(k);
  }
}

/** edge loop through 4-valent vertices */
export function edgeLoop(m: Mesh, key: string): Set<string> {
  const t = topologyOf(m);
  const e = t.edges.get(key);
  if (!e) return new Set();
  if (e.faces.length === 1) return boundaryLoop(t, key);
  const out = new Set<string>([key]);
  const forward = t.heOf(e.faces[0], e.a, e.b);
  const h0 = forward >= 0 ? forward : t.heOf(e.faces[0], e.b, e.a);
  for (const start of [h0, t.heTwin[h0]]) if (start >= 0) walkLoop(t, start, out);
  return out;
}

export interface RingStep {
  face: number;
  ein: string;
  eout: string;
}

interface Walk {
  steps: RingStep[];
  closed: boolean;
}

/** the edge of a quad opposite to `key`, or null when the face is not a quad containing it */
function oppositeEdge(face: number[], key: string): string | null {
  if (face.length !== 4) return null;
  const i = face.findIndex((v, k) => edgeKey(v, face[(k + 1) % 4]) === key);
  if (i < 0) return null;
  return edgeKey(face[(i + 2) % 4], face[(i + 3) % 4]);
}

function walkRing(m: Mesh, t: Topology, key: string, fromFace: number): Walk {
  const steps: RingStep[] = [];
  let cur = key;
  let prev = fromFace;
  for (let guard = 0; guard < MAX_WALK; guard++) {
    const e = t.edges.get(cur)!;
    if (e.faces.length > 2) break;
    const f = e.faces.find((x) => x !== prev);
    if (f === undefined) break;
    const opp = oppositeEdge(m.f[f], cur);
    if (opp === null) break;
    steps.push({ face: f, ein: cur, eout: opp });
    if (opp === key) return { steps, closed: true };
    cur = opp;
    prev = f;
  }
  return { steps, closed: false };
}

/** ordered walk across quads, entering through one edge and leaving through the opposite one */
export function ringWalk(m: Mesh, key: string): Walk {
  const t = topologyOf(m);
  if (!t.edges.has(key)) return { steps: [], closed: false };
  const fwd = walkRing(m, t, key, -1);
  if (fwd.closed || !fwd.steps.length) return fwd;
  const back = walkRing(m, t, key, fwd.steps[0].face);
  const reversed = back.steps.map((s) => ({ face: s.face, ein: s.eout, eout: s.ein })).reverse();
  return { steps: reversed.concat(fwd.steps), closed: false };
}

export function edgeRing(m: Mesh, key: string): Set<string> {
  const out = new Set<string>([key]);
  for (const s of ringWalk(m, key).steps) {
    out.add(s.ein);
    out.add(s.eout);
  }
  return out;
}
