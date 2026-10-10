import type { Mesh } from "../mesh";
import { edgeKey } from "../mesh";
import { faceRunsForward, invalidateTopology, topologyOf } from "../topology";
import { fitPlane, sortedAroundCenter } from "./plane-fit";

/** +1 for every neighbouring face that runs a shared edge the other way, -1 when it runs the same way */
function windingAgreement(m: Mesh, loop: number[]): number {
  const t = topologyOf(m);
  let agree = 0;
  for (let i = 0; i < loop.length; i++) {
    const a = loop[i];
    const b = loop[(i + 1) % loop.length];
    const e = t.edges.get(edgeKey(a, b));
    if (!e) continue;
    for (const fi of e.faces) agree += faceRunsForward(m, fi, a, b) ? -1 : 1;
  }
  return agree;
}

/** Close a hole: one face through the selected vertices, ordered around their centre. Returns its index. */
export function fill(m: Mesh, verts: Set<number>, slot = 0): number | false {
  const ids = [...verts];
  if (ids.length < 3) return false;
  const plane = fitPlane(m, ids);
  if (!plane) return false;
  const loop = sortedAroundCenter(m, plane, ids);
  if (windingAgreement(m, loop) < 0) loop.reverse();
  m.f.push(loop);
  m.fm.push(slot);
  invalidateTopology(m);
  return m.f.length - 1;
}
