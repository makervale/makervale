import type { Vec3 } from "../../vec";
import { cross, dot, normalize, sub } from "../../vec";
import type { Mesh } from "../mesh";
import { faceNormal } from "../mesh";
import type { ElementSelection } from "../selection";
import { facesSelection } from "../selection-of";
import type { Edge } from "../topology";
import { edgeDirection, invalidateTopology, topologyOf } from "../topology";
import { removeFaces } from "./rewrite";

interface Candidate {
  /** how far from right angles the quad's corners are; lower is squarer */
  squareness: number;
  a: number;
  b: number;
  quad: number[];
}

const corner = (m: Mesh, q: number[], k: number): [Vec3, Vec3] => [
  sub(m.v[q[(k + 1) % 4]], m.v[q[k]]),
  sub(m.v[q[(k + 2) % 4]], m.v[q[(k + 1) % 4]]),
];

function isConvexQuad(m: Mesh, q: number[], n: Vec3): boolean {
  for (let k = 0; k < 4; k++) if (dot(cross(...corner(m, q, k)), n) <= 1e-12) return false;
  return true;
}

function squareness(m: Mesh, q: number[]): number {
  let s = 0;
  for (let k = 0; k < 4; k++) {
    const [d1, d2] = corner(m, q, k);
    s += Math.abs(dot(normalize(d1), normalize(d2)));
  }
  return s;
}

/** the quad two coplanar triangles of the same slot make across edge e, or null */
function candidateFor(m: Mesh, e: Edge, faces: Set<number>, minCos: number): Candidate | null {
  if (e.faces.length !== 2) return null;
  const [fa, fb] = e.faces;
  if (!faces.has(fa) || !faces.has(fb)) return null;
  const A = m.f[fa];
  const B = m.f[fb];
  if (A.length !== 3 || B.length !== 3 || m.fm[fa] !== m.fm[fb]) return null;
  const nA = faceNormal(m, A);
  if (dot(nA, faceNormal(m, B)) < minCos) return null;
  // A runs x→y→oa, B runs y→x→ob
  const [x, y] = edgeDirection(m, e, fa);
  const oa = A.find((v) => v !== x && v !== y)!;
  const ob = B.find((v) => v !== x && v !== y)!;
  const quad = [x, ob, y, oa];
  if (!isConvexQuad(m, quad, nA)) return null;
  return { squareness: squareness(m, quad), a: fa, b: fb, quad };
}

/** Merge pairs of coplanar triangles into quads, squarest pairs first. */
export function trisToQuads(m: Mesh, faces: Set<number>, maxAngleDegrees = 10): ElementSelection {
  const minCos = Math.cos((maxAngleDegrees * Math.PI) / 180);
  const candidates: Candidate[] = [];
  for (const e of topologyOf(m).edges.values()) {
    const c = candidateFor(m, e, faces, minCos);
    if (c) candidates.push(c);
  }
  candidates.sort((p, q) => p.squareness - q.squareness);
  const used = new Set<number>();
  const quads: { quad: number[]; slot: number }[] = [];
  for (const c of candidates) {
    if (used.has(c.a) || used.has(c.b)) continue;
    used.add(c.a);
    used.add(c.b);
    quads.push({ quad: c.quad, slot: m.fm[c.a] });
  }
  removeFaces(m, used);
  const out: number[] = [];
  for (const q of quads) {
    m.f.push(q.quad);
    m.fm.push(q.slot);
    out.push(m.f.length - 1);
  }
  invalidateTopology(m);
  return facesSelection(out);
}
