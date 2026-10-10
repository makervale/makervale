import type { ElementSelection } from "./selection";
import { emptySelection } from "./selection";

/** selections that operations hand back: the elements the user should see selected next */
export function facesSelection(faces: Iterable<number>): ElementSelection {
  const s = emptySelection();
  for (const f of faces) s.faces.add(f);
  return s;
}

export function edgesSelection(keys: Iterable<string>): ElementSelection {
  const s = emptySelection();
  for (const k of keys) s.edges.add(k);
  return s;
}

export function vertsSelection(verts: Iterable<number>): ElementSelection {
  const s = emptySelection();
  for (const v of verts) s.verts.add(v);
  return s;
}
