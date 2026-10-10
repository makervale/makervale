import type { Vec3 } from "../vec";
import { div3 } from "../vec";
import { findCaps } from "./bevel-caps";
import { BevelPoints } from "./bevel-points";
import type { BevelParts } from "./bevel-round";
import { roundBevel } from "./bevel-round";
import type { Mesh } from "./mesh";
import { edgeKey, parseEdgeKey } from "./mesh";
import { dropOrphans } from "./ops/rewrite";
import type { ElementSelection } from "./selection";
import { emptySelection } from "./selection";
import { facesSelection } from "./selection-of";
import type { Topology } from "./topology";
import { edgeDirection, invalidateTopology, topologyOf } from "./topology";

/**
 * Edge bevel: a chamfer (one segment) or a rounded fillet (more). Every face corner touching a beveled
 * edge is replaced by points pulled back along the face; each beveled edge becomes a strip between its
 * two faces; the holes left at vertices are closed with caps. Works in metres, so `width` is true.
 */

/** only manifold edges between two distinct faces can be beveled */
function bevelable(t: Topology, edges: Set<string>): Set<string> {
  const out = new Set<string>();
  for (const k of edges) {
    const e = t.edges.get(k);
    if (e && e.faces.length === 2 && e.faces[0] !== e.faces[1]) out.add(k);
  }
  return out;
}

interface Corners {
  faces: number[][];
  /** "face:vertex" → the one new point next to the beveled edge there */
  byFace: Map<string, number>;
}

/** the face's corners at beveled vertices replaced by new points */
function replaceCorners(m: Mesh, beveled: Set<string>, points: BevelPoints): Corners {
  const bevelVerts = new Set([...beveled].flatMap(parseEdgeKey));
  const byFace = new Map<string, number>();
  const faces = m.f.map((p, fi) =>
    p.flatMap((v, k) => {
      if (!bevelVerts.has(v)) return [v];
      const prev = p[(k - 1 + p.length) % p.length];
      const next = p[(k + 1) % p.length];
      const comesIn = beveled.has(edgeKey(prev, v));
      const goesOut = beveled.has(edgeKey(v, next));
      if (!comesIn && !goesOut) return [points.along(v, prev), points.along(v, next)];
      // the point next to the beveled edge: on the other edge, or inside when both edges are beveled
      const i = comesIn && goesOut ? points.inside(v, prev, next, fi) : points.along(v, goesOut ? prev : next);
      byFace.set(`${fi}:${v}`, i);
      return [i];
    }),
  );
  return { faces, byFace };
}

/** one strip per beveled edge; face f runs u→v and g runs v→u, so the strip runs each face edge backwards */
function strips(m: Mesh, t: Topology, beveled: Set<string>, corners: Corners) {
  const polys: number[][] = [];
  const slots: number[] = [];
  const at = (fi: number, v: number): number => corners.byFace.get(`${fi}:${v}`)!;
  for (const k of beveled) {
    const e = t.edges.get(k)!;
    const [f, g] = e.faces;
    const [u, v] = edgeDirection(m, e, f);
    polys.push([at(f, v), at(f, u), at(g, u), at(g, v)]);
    slots.push(m.fm[f]);
  }
  return { polys, slots };
}

function bevelParts(m: Mesh, t: Topology, beveled: Set<string>, points: BevelPoints): BevelParts {
  const corners = replaceCorners(m, beveled, points);
  const strip = strips(m, t, beveled, corners);
  const caps = findCaps(corners.faces.concat(strip.polys), points.owner);
  return {
    faces: corners.faces,
    faceSlots: m.fm.slice(),
    strips: strip.polys,
    stripSlots: strip.slots,
    caps,
    capSlots: caps.map((c) => m.fm[t.vertFaces[c.owner][0]]),
  };
}

function flatBevel(parts: BevelParts): { polys: number[][]; slots: number[] } {
  return {
    polys: parts.faces.concat(
      parts.strips,
      parts.caps.map((c) => c.loop),
    ),
    slots: parts.faceSlots.concat(parts.stripSlots, parts.capSlots),
  };
}

/** Bevel edges by `width` metres in `segments` steps. Returns the new strip and cap faces. */
export function bevel(
  m: Mesh,
  edges: Set<string>,
  width: number,
  segments = 1,
  size: Vec3 = [1, 1, 1],
): ElementSelection {
  const t = topologyOf(m);
  const beveled = bevelable(t, edges);
  if (!beveled.size || !(width > 0)) return emptySelection();
  const sz: Vec3 = [size[0] || 1, size[1] || 1, size[2] || 1];
  const points = new BevelPoints(m, sz, width);
  const parts = bevelParts(m, t, beveled, points);
  const segs = Math.max(1, segments | 0);
  const built = segs > 1 ? roundBevel(points, parts, segs) : flatBevel(parts);
  const firstNew = parts.faces.length;
  m.v = points.pos.map((p) => div3(p, sz));
  m.f = built.polys;
  m.fm = built.slots;
  // the old bevel vertices are no longer used by any face
  dropOrphans(m);
  invalidateTopology(m);
  const added: number[] = [];
  for (let i = firstNew; i < m.f.length; i++) added.push(i);
  return facesSelection(added);
}
