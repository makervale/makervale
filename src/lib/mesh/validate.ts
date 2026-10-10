import type { Mesh } from "./mesh";
import { faceArea, signedVolume, triangleCount } from "./mesh";
import type { Topology } from "./topology";
import { faceRunsForward, topologyOf } from "./topology";

/** Mesh health report used by "Check mesh" and by the export profiles. */
export interface MeshReport {
  verts: number;
  edges: number;
  faces: number;
  tris: number;
  quads: number;
  ngons: number[];
  open: string[];
  nonManifold: string[];
  flipped: string[];
  degenerate: number[];
  loose: number[];
  parts: number;
  closed: boolean;
  volume: number;
}

const DEGENERATE_AREA = 1e-10;

function classifyEdges(m: Mesh, t: Topology): Pick<MeshReport, "open" | "nonManifold" | "flipped"> {
  const open: string[] = [];
  const nonManifold: string[] = [];
  const flipped: string[] = [];
  for (const [key, e] of t.edges) {
    if (e.faces.length === 1) open.push(key);
    else if (e.faces.length > 2) nonManifold.push(key);
    else if (faceRunsForward(m, e.faces[0], e.a, e.b) === faceRunsForward(m, e.faces[1], e.a, e.b)) {
      // neighbours must run their shared edge in opposite directions
      flipped.push(key);
    }
  }
  return { open, nonManifold, flipped };
}

/** connected parts, joined through shared edges */
function countParts(m: Mesh, t: Topology): number {
  const parent = m.f.map((_, i) => i);
  const find = (i: number): number => (parent[i] === i ? i : (parent[i] = find(parent[i])));
  for (const e of t.edges.values()) {
    for (let i = 1; i < e.faces.length; i++) {
      const a = find(e.faces[0]);
      const b = find(e.faces[i]);
      if (a !== b) parent[a] = b;
    }
  }
  return new Set(m.f.map((_, i) => find(i))).size;
}

export function inspect(m: Mesh): MeshReport {
  const t = topologyOf(m);
  const edges = classifyEdges(m, t);
  const ngons: number[] = [];
  const degenerate: number[] = [];
  m.f.forEach((face, i) => {
    if (face.length > 4) ngons.push(i);
    if (faceArea(m, face) < DEGENERATE_AREA) degenerate.push(i);
  });
  const loose: number[] = [];
  for (let i = 0; i < m.v.length; i++) if (!t.vertFaces[i].length) loose.push(i);
  return {
    verts: m.v.length,
    edges: t.edges.size,
    faces: m.f.length,
    tris: triangleCount(m),
    quads: m.f.filter((face) => face.length === 4).length,
    ngons,
    ...edges,
    degenerate,
    loose,
    parts: countParts(m, t),
    closed: edges.open.length === 0 && edges.nonManifold.length === 0 && m.f.length > 0,
    volume: signedVolume(m),
  };
}
