import type { Mesh } from "../mesh";
import { invalidateTopology } from "../topology";

/** Join another mesh into this one (its vertices already in this mesh's space); its slots shift by `slotOffset`. */
export function append(m: Mesh, other: Mesh, slotOffset = 0): void {
  const base = m.v.length;
  for (const p of other.v) m.v.push([...p]);
  other.f.forEach((face, i) => {
    m.f.push(face.map((j) => j + base));
    m.fm.push(other.fm[i] + slotOffset);
  });
  invalidateTopology(m);
}
