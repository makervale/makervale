/** The simplifier's own thread: decimating a heavy mesh takes long enough to stutter a frame on a phone. */
import type { Mesh } from "@/lib/mesh/mesh";
import { simplify } from "./simplify";

interface Job {
  key: string;
  mesh: Mesh;
  ratio: number;
}

self.onmessage = (e: MessageEvent<Job>) => {
  const { key, mesh, ratio } = e.data;
  self.postMessage({ key, mesh: simplify(mesh, ratio) });
};
