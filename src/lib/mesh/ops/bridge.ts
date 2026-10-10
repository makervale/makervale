import { distance, sub } from "../../vec";
import type { Chain } from "../boundary-chains";
import { borderSuccessors, chainsOf } from "../boundary-chains";
import type { Mesh } from "../mesh";
import { edgeKey } from "../mesh";
import { centroid, lerp3 } from "../points";
import type { ElementSelection } from "../selection";
import { facesSelection } from "../selection-of";
import { invalidateTopology, topologyOf } from "../topology";
import { deleteFaces } from "./delete";

/** the edges along the border of a face region */
function regionBorder(m: Mesh, faces: Set<number>): string[] {
  const t = topologyOf(m);
  const out: string[] = [];
  for (const fi of faces) {
    const face = m.f[fi];
    face.forEach((a, k) => {
      const key = edgeKey(a, face[(k + 1) % face.length]);
      if (t.edges.get(key)!.faces.filter((f) => faces.has(f)).length === 1) out.push(key);
    });
  }
  return out;
}

/** faces mode: delete the faces and bridge the holes they leave (the mesh must have no other holes) */
function openHoles(m: Mesh, faces: Set<number>): string[] {
  if (!regionBorder(m, faces).length) throw new Error("Select faces on the two parts that should be connected");
  // deleting renumbers vertices, so the holes are found again as the mesh's open edges
  deleteFaces(m, faces);
  const keys: string[] = [];
  for (const [k, e] of topologyOf(m).edges) if (e.faces.length === 1) keys.push(k);
  if (chainsOf(borderSuccessors(m, keys)).length !== 2) {
    throw new Error("Bridge needs exactly two holes (select one face on each part, or two edge loops)");
  }
  return keys;
}

function twoMatchingChains(m: Mesh, keys: Iterable<string>): [Chain, Chain] {
  const next = borderSuccessors(m, keys);
  if (!next.size) throw new Error("Bridge connects open edges or selected faces");
  const chains = chainsOf(next);
  if (chains.length !== 2) throw new Error(`Select exactly two loops or two edge chains (now: ${chains.length})`);
  const [a, b] = chains;
  if (a.verts.length !== b.verts.length) {
    throw new Error(`The loops must have the same number of points (${a.verts.length} and ${b.verts.length})`);
  }
  if (a.closed !== b.closed) throw new Error("One loop is closed, the other is open");
  return [a, b];
}

/**
 * B runs against A, so A[i] pairs with B[(shift − i) mod n]. Closed loops take the shift whose
 * pairs are most alike relative to their centres; open chains pair A's start with B's end.
 */
function pairingShift(m: Mesh, a: number[], b: number[], closed: boolean): number {
  const n = a.length;
  if (!closed) return n - 1;
  const ca = centroid(m, a);
  const cb = centroid(m, b);
  let best = 0;
  let bestDist = Infinity;
  for (let s = 0; s < n; s++) {
    let d = 0;
    for (let i = 0; i < n; i++) d += distance(sub(m.v[a[i]], ca), sub(m.v[b[(((s - i) % n) + n) % n]], cb));
    if (d < bestDist) {
      bestDist = d;
      best = s;
    }
  }
  return best;
}

/** rows of vertices from A to its partners, with `cuts` new rows between */
function bridgeRows(m: Mesh, a: number[], partner: number[], cuts: number): number[][] {
  const rows: number[][] = [a.slice()];
  for (let c = 1; c <= cuts; c++) {
    rows.push(
      a.map((v, i) => {
        m.v.push(lerp3(m.v[v], m.v[partner[i]], c / (cuts + 1)));
        return m.v.length - 1;
      }),
    );
  }
  rows.push(partner);
  return rows;
}

/**
 * Connect two open loops (or chains) of the same length with a band of quads.
 * Either pass border edges, or faces: then those faces are deleted and the holes they leave are bridged.
 */
export function bridge(m: Mesh, edges: Set<string>, faces: Set<number>, cuts = 0): ElementSelection {
  const keys = faces.size ? openHoles(m, faces) : [...edges];
  const [a, b] = twoMatchingChains(m, keys);
  const n = a.verts.length;
  const shift = pairingShift(m, a.verts, b.verts, a.closed);
  const partner = a.verts.map((_, i) => b.verts[(((shift - i) % n) + n) % n]);
  const firstEdge = topologyOf(m).edges.get(edgeKey(a.verts[0], a.verts[1 % n]));
  const slot = m.fm[firstEdge?.faces[0] ?? 0] ?? 0;
  const rows = bridgeRows(m, a.verts, partner, Math.max(0, cuts | 0));
  const segments = a.closed ? n : n - 1;
  const out: number[] = [];
  for (let r = 0; r + 1 < rows.length; r++) {
    for (let i = 0; i < segments; i++) {
      const j = (i + 1) % n;
      m.f.push([rows[r][j], rows[r][i], rows[r + 1][i], rows[r + 1][j]]);
      m.fm.push(slot);
      out.push(m.f.length - 1);
    }
  }
  invalidateTopology(m);
  return facesSelection(out);
}
