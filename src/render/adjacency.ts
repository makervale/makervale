/** The edges and vertex neighbours of a mesh, as the overlay and element picking need them. */
import type { Mesh } from "@/lib/mesh/mesh";
import { edgeKey } from "@/lib/mesh/mesh";

export interface Adjacency {
  /** edge key → its two vertices, a < b */
  edges: Map<string, [number, number]>;
  /** per vertex: the vertices it shares an edge with */
  neighbours: number[][];
}

interface Cached {
  revision: number;
  faces: number[][];
  adjacency: Adjacency;
}

const cache = new WeakMap<Mesh, Cached>();

function buildAdjacency(m: Mesh): Adjacency {
  const edges = new Map<string, [number, number]>();
  const neighbours: number[][] = Array.from({ length: m.v.length }, () => []);
  for (const face of m.f) {
    for (let k = 0; k < face.length; k++) {
      const a = face[k];
      const b = face[(k + 1) % face.length];
      const key = edgeKey(a, b);
      if (edges.has(key)) continue;
      edges.set(key, [Math.min(a, b), Math.max(a, b)]);
      neighbours[a].push(b);
      neighbours[b].push(a);
    }
  }
  return { edges, neighbours };
}

/** cached per mesh and revision (the revision moves whenever a command changes the mesh) */
export function adjacencyOf(m: Mesh, revision: number): Adjacency {
  const hit = cache.get(m);
  if (hit && hit.revision === revision && hit.faces === m.f) return hit.adjacency;
  const adjacency = buildAdjacency(m);
  cache.set(m, { revision, faces: m.f, adjacency });
  return adjacency;
}
