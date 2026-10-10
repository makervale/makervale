import type { Mesh } from "../mesh";

export function genTorus(seg = 24, thickness = 0.35): Mesh {
  const n = Math.max(3, seg | 0);
  const m = Math.max(3, Math.round(n / 2));
  const r = Math.min(0.49, Math.max(0.02, thickness)) * 0.5;
  const bigR = 0.5 - r;
  const mesh: Mesh = { v: [], f: [], fm: [] };
  for (let i = 0; i < n; i++) {
    const a = (i / n) * Math.PI * 2;
    for (let j = 0; j < m; j++) {
      const b = (j / m) * Math.PI * 2;
      const rr = bigR + r * Math.cos(b);
      mesh.v.push([Math.cos(a) * rr, Math.sin(a) * rr, r * Math.sin(b)]);
    }
  }
  for (let i = 0; i < n; i++) {
    for (let j = 0; j < m; j++) {
      const i2 = (i + 1) % n;
      const j2 = (j + 1) % m;
      mesh.f.push([i * m + j, i2 * m + j, i2 * m + j2, i * m + j2]);
      mesh.fm.push(0);
    }
  }
  // fill the unit box; the object's size sets the real proportions
  for (const p of mesh.v) p[2] *= 0.5 / r;
  return mesh;
}
