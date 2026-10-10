import type { Vec3 } from "../../vec";
import { add, div3, dot, mul3, normalize, scale, sub } from "../../vec";
import type { Mesh } from "../mesh";
import { safeSize, scaledNormal } from "../scaled";
import type { ElementSelection } from "../selection";
import { facesSelection } from "../selection-of";
import type { Topology } from "../topology";
import { edgeDirection, invalidateTopology, topologyOf } from "../topology";

/** at sharp corners the offset grows by 1/cos so walls keep their thickness, but never beyond 1/0.3 */
const MIN_CORNER_COS = 0.3;

interface Shell {
  t: Topology;
  /** face normals in metres */
  normals: Vec3[];
  thickness: number;
  size: Vec3;
}

/** the inner copy of vertex i: moved back along its normal so the wall is `thickness` metres thick */
function offsetVertex(m: Mesh, i: number, { t, normals, thickness, size }: Shell): Vec3 {
  const faces = t.vertFaces[i];
  let sum: Vec3 = [0, 0, 0];
  for (const f of faces) sum = add(sum, normals[f]);
  const n = normalize(sum);
  let c = 0;
  for (const f of faces) c += Math.max(MIN_CORNER_COS, dot(n, normals[f]));
  c = faces.length ? c / faces.length : 1;
  return div3(sub(mul3(m.v[i], size), scale(n, thickness / c)), size);
}

/** Give a surface thickness: an inner copy facing the other way, joined to it along open borders. */
export function solidify(m: Mesh, thickness: number, size: Vec3): ElementSelection {
  const s = safeSize(size);
  const t = topologyOf(m);
  const faceCount = m.f.length;
  const shell: Shell = { t, normals: m.f.map((face) => scaledNormal(m, face, s)), thickness, size: s };
  const used = new Set(m.f.flat());
  const inner = new Map<number, number>();
  for (const i of used) {
    inner.set(i, m.v.length);
    m.v.push(offsetVertex(m, i, shell));
  }
  const out: number[] = [];
  const addFace = (face: number[], slot: number): void => {
    m.f.push(face);
    m.fm.push(slot);
    out.push(m.f.length - 1);
  };
  for (let fi = 0; fi < faceCount; fi++) addFace(m.f[fi].map((i) => inner.get(i)!).reverse(), m.fm[fi]);
  for (const e of t.edges.values()) {
    if (e.faces.length !== 1) continue;
    const [a, b] = edgeDirection(m, e);
    addFace([b, a, inner.get(a)!, inner.get(b)!], m.fm[e.faces[0]]);
  }
  invalidateTopology(m);
  return facesSelection(out);
}
