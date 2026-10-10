import type { Vec3 } from "../../vec";
import { add, distance, div3, mul3, normalize, scale, sub } from "../../vec";
import type { Mesh } from "../mesh";
import { safeSize } from "../scaled";
import type { ElementSelection } from "../selection";
import { vertsSelection } from "../selection-of";
import { invalidateTopology, topologyOf } from "../topology";

/** a ring point never reaches past this share of its edge, so neighbouring rings cannot cross */
const MAX_EDGE_SHARE = 0.45;

/** one new point on every edge out of v, `radius` metres from it; neighbour → new point */
function ringAround(m: Mesh, v: number, radius: number, size: Vec3): Map<number, number> {
  const p = mul3(m.v[v], size);
  const ring = new Map<number, number>();
  for (const x of topologyOf(m).vertNbrs[v]) {
    const q = mul3(m.v[x], size);
    const r = Math.min(radius, MAX_EDGE_SHARE * distance(p, q));
    m.v.push(div3(add(p, scale(normalize(sub(q, p)), r)), size));
    ring.set(x, m.v.length - 1);
  }
  return ring;
}

/**
 * Chamfer a vertex into a small ring and keep the vertex as the tip of a triangle fan.
 * The caller drags the tip out to make a spike. `radius` is in metres.
 */
export function spikeVertex(m: Mesh, v: number, radius: number, size: Vec3): { sel: ElementSelection; tip: number } {
  const s = safeSize(size);
  const faces = topologyOf(m).vertFaces[v];
  const ring = ringAround(m, v, radius, s);
  const fans: { tri: number[]; slot: number }[] = [];
  for (const fi of faces) {
    const face = m.f[fi];
    const i = face.indexOf(v);
    const before = ring.get(face[(i - 1 + face.length) % face.length])!;
    const after = ring.get(face[(i + 1) % face.length])!;
    m.f[fi] = [...face.slice(0, i), before, after, ...face.slice(i + 1)];
    fans.push({ tri: [v, after, before], slot: m.fm[fi] });
  }
  for (const fan of fans) {
    m.f.push(fan.tri);
    m.fm.push(fan.slot);
  }
  invalidateTopology(m);
  return { sel: vertsSelection([v]), tip: v };
}
