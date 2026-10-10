import type { Mesh } from "../mesh";
import { edgeKey, signedVolume } from "../mesh";
import type { Topology } from "../topology";
import { faceRunsForward, invalidateTopology, topologyOf } from "../topology";

/** Face winding: flipping, making it consistent, pointing it outward. */

/** reverse one face, keeping its UVs aligned */
export function reverseFace(m: Mesh, fi: number): void {
  m.f[fi].reverse();
  if (m.uv?.[fi]) m.uv[fi].reverse();
}

export function flip(m: Mesh, faces?: Set<number>): void {
  m.f.forEach((_, i) => {
    if (!faces || faces.has(i)) reverseFace(m, i);
  });
  invalidateTopology(m);
}

/** Flip every face if the closed mesh came out inside-out. */
export function orientOutward(m: Mesh): Mesh {
  if (signedVolume(m) < 0) m.f.forEach((face) => face.reverse());
  return m;
}

/** walk the part containing `start`, flipping neighbours that run a shared edge the same way */
function alignPart(m: Mesh, t: Topology, start: number, seen: Int8Array): { part: number[]; flipped: number } {
  const part: number[] = [];
  const stack = [start];
  let flipped = 0;
  seen[start] = 1;
  while (stack.length) {
    const f = stack.pop()!;
    part.push(f);
    const face = m.f[f];
    for (let k = 0; k < face.length; k++) {
      const a = face[k];
      const b = face[(k + 1) % face.length];
      const e = t.edges.get(edgeKey(a, b))!;
      if (e.faces.length !== 2) continue;
      const g = e.faces[0] === f ? e.faces[1] : e.faces[0];
      if (seen[g]) continue;
      if (faceRunsForward(m, g, a, b)) {
        reverseFace(m, g);
        flipped++;
      }
      seen[g] = 1;
      stack.push(g);
    }
  }
  return { part, flipped };
}

function isClosedPart(m: Mesh, t: Topology, part: number[]): boolean {
  return part.every((f) => {
    const face = m.f[f];
    return face.every((a, k) => t.edges.get(edgeKey(a, face[(k + 1) % face.length]))!.faces.length === 2);
  });
}

/** Make winding consistent across each connected part, then point closed parts outward. Returns flips made. */
export function recalcNormals(m: Mesh): number {
  const t = topologyOf(m);
  const seen = new Int8Array(m.f.length);
  let flipped = 0;
  for (let s = 0; s < m.f.length; s++) {
    if (seen[s]) continue;
    const aligned = alignPart(m, t, s, seen);
    flipped += aligned.flipped;
    const partMesh: Mesh = { v: m.v, f: aligned.part.map((i) => m.f[i]), fm: [] };
    if (isClosedPart(m, t, aligned.part) && signedVolume(partMesh) < 0) {
      for (const i of aligned.part) reverseFace(m, i);
      flipped += aligned.part.length;
    }
  }
  invalidateTopology(m);
  return flipped;
}
