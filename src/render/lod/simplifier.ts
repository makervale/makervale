/**
 * Simpler versions of heavy meshes, made on a worker thread (worker.ts, bundled into the page by build.mjs) one at
 * a time, and kept by the mesh's identity and revision. Without a worker (tests, old browsers) there are none, and
 * objects are drawn in full or as a box.
 */
import type { Mesh } from "@/lib/mesh/mesh";
import { cloneMesh } from "@/lib/mesh/mesh";

declare const __LOD_WORKER__: string | undefined;

/** keep about this share of the triangles */
export const SIMPLE_RATIO = 0.35;

type Done = (mesh: Mesh | null) => void;

export class Simplifier {
  private worker: Worker | null = null;
  private queue: { id: string; key: string; mesh: Mesh; done: Done }[] = [];
  private busy: { key: string; done: Done } | null = null;

  constructor() {
    if (typeof __LOD_WORKER__ !== "string" || typeof Worker === "undefined") return;
    try {
      this.worker = new Worker(URL.createObjectURL(new Blob([__LOD_WORKER__], { type: "text/javascript" })));
      this.worker.onmessage = (e) => this.finished(e.data as { key: string; mesh: Mesh | null });
    } catch {
      this.worker = null;
    }
  }

  get available(): boolean {
    return this.worker !== null;
  }

  /** ask for a simpler version; `done` gets it (or null) later */
  request(id: string, key: string, mesh: Mesh, done: Done): void {
    if (!this.worker || this.queue.some((j) => j.key === key) || this.busy?.key === key) return;
    // a newer mesh of the same object replaces the one still waiting
    this.queue = this.queue.filter((j) => j.id !== id);
    this.queue.push({ id, key, mesh: cloneMesh(mesh), done });
    this.next();
  }

  private next(): void {
    if (this.busy || !this.worker) return;
    const job = this.queue.shift();
    if (!job) return;
    this.busy = { key: job.key, done: job.done };
    this.worker.postMessage({ key: job.key, mesh: job.mesh, ratio: SIMPLE_RATIO });
  }

  private finished(r: { key: string; mesh: Mesh | null }): void {
    const job = this.busy;
    this.busy = null;
    if (job && job.key === r.key) job.done(r.mesh);
    this.next();
  }
}
