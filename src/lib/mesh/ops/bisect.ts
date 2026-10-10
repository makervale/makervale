import type { Plane } from "../axis";
import type { Mesh } from "../mesh";
import { edgeKey } from "../mesh";
import { lerp3 } from "../points";
import type { ElementSelection } from "../selection";
import { emptySelection } from "../selection";
import { invalidateTopology } from "../topology";
import { capOnPlane, rimOnPlane } from "./bisect-cap";
import type { Side } from "./plane-side";
import { ON_PLANE, planeDistance, sideOf } from "./plane-side";
import { dropOrphans, removeFaces } from "./rewrite";

/** Cut faces with a plane; optionally remove one side and cap the cut. */
export interface BisectOptions {
  /** which side to delete: "front" is the side the normal points to */
  remove?: "none" | "front" | "back";
  /** close the cut with faces after removing a side */
  fill?: boolean;
}

/** a new vertex on every edge of the chosen faces that crosses the plane, spliced into every face using it */
function cutCrossingEdges(m: Mesh, chosen: (fi: number) => boolean, dist: (i: number) => number): void {
  const cut = new Map<string, number>();
  m.f.forEach((face, fi) => {
    if (!chosen(fi)) return;
    face.forEach((a, k) => {
      const b = face[(k + 1) % face.length];
      const [da, db] = [dist(a), dist(b)];
      const key = edgeKey(a, b);
      if (sideOf(da) * sideOf(db) !== -1 || cut.has(key)) return;
      m.v.push(lerp3(m.v[a], m.v[b], da / (da - db)));
      cut.set(key, m.v.length - 1);
    });
  });
  m.f = m.f.map((face) =>
    face.flatMap((a, k) => {
      const c = cut.get(edgeKey(a, face[(k + 1) % face.length]));
      return c === undefined ? [a] : [a, c];
    }),
  );
}

/** positions of the two on-plane corners where a face crossing the plane splits, or null */
function splitCorners(face: number[], sides: Side[]): [number, number] | null {
  if (!sides.includes(1) || !sides.includes(-1)) return null;
  const on = sides.flatMap((s, k) => (s === 0 ? [k] : []));
  if (on.length !== 2) return null;
  const [i, j] = on;
  if ((i + 1) % face.length === j || (j + 1) % face.length === i) return null;
  return [i, j];
}

/** split each chosen face between its two on-plane corners; returns the new edges and the chosen faces' new indices */
function splitAcross(m: Mesh, chosen: (fi: number) => boolean, dist: (i: number) => number) {
  const f: number[][] = [];
  const fm: number[] = [];
  const edges: string[] = [];
  const pieces = new Set<number>();
  const keep = (face: number[], slot: number, fromChosen: boolean): void => {
    if (fromChosen) pieces.add(f.length);
    f.push(face);
    fm.push(slot);
  };
  m.f.forEach((face, fi) => {
    const corners = chosen(fi)
      ? splitCorners(
          face,
          face.map((i) => sideOf(dist(i))),
        )
      : null;
    if (!corners) return keep(face, m.fm[fi], chosen(fi));
    const [i, j] = corners;
    keep(face.slice(i, j + 1), m.fm[fi], true);
    keep([...face.slice(j), ...face.slice(0, i + 1)], m.fm[fi], true);
    edges.push(edgeKey(face[i], face[j]));
  });
  m.f = f;
  m.fm = fm;
  return { edges, pieces };
}

/** faces (among `candidates`) lying on the removed side; their mean distance decides */
function facesOnSide(m: Mesh, candidates: (fi: number) => boolean, dist: (i: number) => number, side: Side) {
  const out = new Set<number>();
  m.f.forEach((face, fi) => {
    if (!candidates(fi)) return;
    let sum = 0;
    for (const i of face) sum += dist(i);
    if (sum * side > ON_PLANE * face.length) out.add(fi);
  });
  return out;
}

export function bisect(m: Mesh, faces: Set<number> | null, plane: Plane, opts: BisectOptions = {}): ElementSelection {
  const dist = planeDistance(m, plane);
  const chosen = (fi: number): boolean => !faces || faces.has(fi);
  cutCrossingEdges(m, chosen, dist);
  const { edges, pieces } = splitAcross(m, chosen, dist);
  invalidateTopology(m);
  const out = emptySelection();
  for (const k of edges) out.edges.add(k);
  if (!opts.remove || opts.remove === "none") return out;
  const removed = facesOnSide(m, (fi) => !faces || pieces.has(fi), dist, opts.remove === "front" ? 1 : -1);
  if (!removed.size) return out;
  removeFaces(m, removed);
  invalidateTopology(m);
  out.edges.clear();
  if (opts.fill) for (const fi of capOnPlane(m, dist)) out.faces.add(fi);
  dropOrphans(m);
  invalidateTopology(m);
  if (!out.faces.size) for (const k of rimOnPlane(m, dist)) out.edges.add(k);
  return out;
}
