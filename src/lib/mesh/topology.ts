import type { Mesh } from "./mesh";
import { edgeKey } from "./mesh";

/**
 * Half-edge adjacency of a polygon mesh.
 * Half-edge h is the corner of face heFace[h] that starts at vertex heVert[h].
 * Vertex moves never invalidate it; see `topologyOf` for when it is rebuilt.
 */
export interface Edge {
  a: number;
  b: number;
  faces: number[];
}

export class Topology {
  readonly faceStart: Int32Array;
  readonly faceLen: Int32Array;
  readonly heVert: Int32Array;
  readonly heFace: Int32Array;
  readonly heTwin: Int32Array;
  readonly edges = new Map<string, Edge>();
  readonly vertFaces: number[][];
  readonly vertNbrs: number[][];

  constructor(m: Mesh) {
    let total = 0;
    this.faceStart = new Int32Array(m.f.length);
    this.faceLen = new Int32Array(m.f.length);
    m.f.forEach((face, i) => {
      this.faceStart[i] = total;
      this.faceLen[i] = face.length;
      total += face.length;
    });
    this.heVert = new Int32Array(total);
    this.heFace = new Int32Array(total);
    this.heTwin = new Int32Array(total).fill(-1);
    this.vertFaces = Array.from({ length: m.v.length }, () => []);
    this.vertNbrs = Array.from({ length: m.v.length }, () => []);
    this.linkTwins(this.fillHalfEdges(m), total);
  }

  /** fills the per-face half-edge arrays; returns the directed edge "a>b" → half-edge map */
  private fillHalfEdges(m: Mesh): Map<string, number> {
    const directed = new Map<string, number>();
    m.f.forEach((face, fi) => {
      const start = this.faceStart[fi];
      face.forEach((a, k) => {
        const b = face[(k + 1) % face.length];
        this.heVert[start + k] = a;
        this.heFace[start + k] = fi;
        this.vertFaces[a].push(fi);
        directed.set(`${a}>${b}`, start + k);
        this.addEdge(a, b, fi);
      });
    });
    return directed;
  }

  private addEdge(a: number, b: number, fi: number): void {
    const key = edgeKey(a, b);
    let e = this.edges.get(key);
    if (!e) {
      e = { a: Math.min(a, b), b: Math.max(a, b), faces: [] };
      this.edges.set(key, e);
      this.vertNbrs[a].push(b);
      this.vertNbrs[b].push(a);
    }
    e.faces.push(fi);
  }

  private linkTwins(directed: Map<string, number>, total: number): void {
    for (let h = 0; h < total; h++) {
      const a = this.heVert[h];
      const b = this.dest(h);
      // boundary or non-manifold edges have no twin
      if (this.edges.get(edgeKey(a, b))!.faces.length !== 2) continue;
      const twin = directed.get(`${b}>${a}`);
      if (twin !== undefined) this.heTwin[h] = twin;
    }
  }

  next(h: number): number {
    const f = this.heFace[h];
    const s = this.faceStart[f];
    return s + ((h - s + 1) % this.faceLen[f]);
  }

  prev(h: number): number {
    const f = this.heFace[h];
    const s = this.faceStart[f];
    const len = this.faceLen[f];
    return s + ((h - s - 1 + len) % len);
  }

  dest(h: number): number {
    return this.heVert[this.next(h)];
  }

  /** half-edge of face f running a→b, or -1 */
  heOf(f: number, a: number, b: number): number {
    const s = this.faceStart[f];
    const len = this.faceLen[f];
    for (let k = 0; k < len; k++) {
      if (this.heVert[s + k] === a && this.heVert[s + ((k + 1) % len)] === b) return s + k;
    }
    return -1;
  }

  isBoundaryEdge(a: number, b: number): boolean {
    return this.edges.get(edgeKey(a, b))?.faces.length === 1;
  }

  isBoundaryVert(v: number): boolean {
    return this.vertNbrs[v].some((n) => this.edges.get(edgeKey(v, n))!.faces.length !== 2);
  }
}

/** the vertex pairs (a, b) of a face loop, in winding order */
export function faceEdges(face: number[]): [number, number][] {
  return face.map((a, k) => [a, face[(k + 1) % face.length]]);
}

/** does face `fi` run a→b (true) or b→a (false)? */
export function faceRunsForward(m: Mesh, fi: number, a: number, b: number): boolean {
  const face = m.f[fi];
  return face[(face.indexOf(a) + 1) % face.length] === b;
}

/** the endpoints of an edge in the winding direction of one of its faces (the first by default) */
export function edgeDirection(m: Mesh, e: Edge, face = e.faces[0]): [number, number] {
  return faceRunsForward(m, face, e.a, e.b) ? [e.a, e.b] : [e.b, e.a];
}

/**
 * The topology is cached per mesh object and reused while `mesh.f` is the same array.
 * Operations in this library replace `mesh.f` or call `invalidateTopology` themselves; a caller that
 * edits faces in place (push, splice, reverse) must call `invalidateTopology(mesh)` afterwards.
 * Moving vertices needs nothing.
 */
const cache = new WeakMap<Mesh, { f: number[][]; topo: Topology }>();

export function topologyOf(m: Mesh): Topology {
  const hit = cache.get(m);
  if (hit && hit.f === m.f) return hit.topo;
  const topo = new Topology(m);
  cache.set(m, { f: m.f, topo });
  return topo;
}

export function invalidateTopology(m: Mesh): void {
  cache.delete(m);
}
