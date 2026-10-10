import { closedLoops } from "../boundary-chains";
import type { Mesh } from "../mesh";
import { edgeDirection, invalidateTopology, topologyOf } from "../topology";
import { ON_PLANE, sideOf } from "./plane-side";

/** After one side of a cut is removed: close the opening, or report its rim. */

/** Fill every closed loop of open edges lying on the plane with one face; returns the new faces. */
export function capOnPlane(m: Mesh, dist: (i: number) => number): number[] {
  const next = new Map<number, number>();
  let slot = 0;
  for (const e of topologyOf(m).edges.values()) {
    if (e.faces.length !== 1 || sideOf(dist(e.a)) !== 0 || sideOf(dist(e.b)) !== 0) continue;
    // the cap runs each rim edge against the face that owns it
    const [a, b] = edgeDirection(m, e);
    next.set(b, a);
    slot = m.fm[e.faces[0]];
  }
  const out: number[] = [];
  for (const loop of closedLoops(next)) {
    if (loop.length < 3) continue;
    m.f.push(loop);
    m.fm.push(slot);
    out.push(m.f.length - 1);
  }
  invalidateTopology(m);
  return out;
}

/** the open edges lying on the plane */
export function rimOnPlane(m: Mesh, dist: (i: number) => number): string[] {
  const out: string[] = [];
  for (const [k, e] of topologyOf(m).edges) {
    if (e.faces.length === 1 && Math.abs(dist(e.a)) <= ON_PLANE && Math.abs(dist(e.b)) <= ON_PLANE) out.push(k);
  }
  return out;
}
