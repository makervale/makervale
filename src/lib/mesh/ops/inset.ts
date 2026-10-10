import { add, scale } from "../../vec";
import type { Mesh } from "../mesh";
import { faceCenter, faceNormal } from "../mesh";
import { lerp3 } from "../points";
import type { ElementSelection } from "../selection";
import { facesSelection } from "../selection-of";
import { invalidateTopology } from "../topology";

/** Shrink each face into a frame: a smaller copy of the face surrounded by a ring of quads. */
export function inset(m: Mesh, faces: Set<number>, thickness = 0.25, depth = 0): ElementSelection {
  for (const fi of faces) {
    const face = m.f[fi];
    const c = faceCenter(m, face);
    const offset = scale(faceNormal(m, face), depth);
    const inner = face.map((vi) => {
      m.v.push(add(lerp3(m.v[vi], c, thickness), offset));
      return m.v.length - 1;
    });
    for (let i = 0; i < face.length; i++) {
      const j = (i + 1) % face.length;
      m.f.push([face[i], face[j], inner[j], inner[i]]);
      m.fm.push(m.fm[fi]);
    }
    m.f[fi] = inner;
  }
  invalidateTopology(m);
  return facesSelection(faces);
}
