import type { Mesh } from "../mesh";
import type { ElementSelection } from "../selection";
import { facesSelection } from "../selection-of";
import { invalidateTopology } from "../topology";
import { triangulatePoly } from "../triangulate";

export type PolygonSplitter = (m: Mesh, face: number[]) => number[][];

/** Split the chosen faces into triangles; the new triangles (and chosen faces already triangles) come back. */
export function triangulate(m: Mesh, faces: Set<number>, split: PolygonSplitter = triangulatePoly): ElementSelection {
  const f: number[][] = [];
  const fm: number[] = [];
  const out: number[] = [];
  m.f.forEach((face, fi) => {
    const pieces = faces.has(fi) && face.length > 3 ? split(m, face) : [face];
    for (const piece of pieces) {
      f.push(piece);
      fm.push(m.fm[fi]);
      if (faces.has(fi)) out.push(f.length - 1);
    }
  });
  m.f = f;
  m.fm = fm;
  invalidateTopology(m);
  return facesSelection(out);
}
