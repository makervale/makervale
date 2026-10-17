/** The simplifier's own thread: decimating a heavy mesh takes long enough to stutter a frame on a phone. */
import { decimate } from "@/lib/mesh/decimate";
import type { Mesh } from "@/lib/mesh/mesh";
import { polygonFrame } from "@/lib/mesh/uv-project";

interface Job {
  key: string;
  mesh: Mesh;
  ratio: number;
}

/** how far past the original box (share of its size) a vertex may end up */
const SPIKE = 0.01;
/** a simpler version that lost more of the surface than this dropped thin parts (cords, rails): it isn't kept */
const AREA_KEPT = 0.9;

const area = (m: Mesh): number => m.f.reduce((s, f) => s + polygonFrame(m.v, f).area, 0);

function extent(m: Mesh): number[] {
  const out = [Infinity, Infinity, Infinity, -Infinity, -Infinity, -Infinity];
  for (const v of m.v) {
    for (let i = 0; i < 3; i++) {
      out[i] = Math.min(out[i], v[i]);
      out[i + 3] = Math.max(out[i + 3], v[i]);
    }
  }
  return out;
}

/** a collapse that pushed a vertex out of the shape's box left a spike: then the simpler version isn't kept */
function grew(a: number[], b: number[]): boolean {
  const size = Math.hypot(a[3] - a[0], a[4] - a[1], a[5] - a[2]);
  return [0, 1, 2].some((i) => b[i] < a[i] - SPIKE * size || b[i + 3] > a[i + 3] + SPIKE * size);
}

self.onmessage = (e: MessageEvent<Job>) => {
  const { key, mesh, ratio } = e.data;
  try {
    const [box, surface] = [extent(mesh), area(mesh)];
    decimate(mesh, ratio);
    const faithful = !grew(box, extent(mesh)) && area(mesh) >= AREA_KEPT * surface;
    self.postMessage({ key, mesh: faithful ? mesh : null });
  } catch {
    self.postMessage({ key, mesh: null });
  }
};
