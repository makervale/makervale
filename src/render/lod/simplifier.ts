/**
 * Simpler versions of heavy meshes, made one at a time and kept by the mesh's identity and revision. They are made
 * on a worker thread (worker.ts, bundled into the page by build.mjs). Where a worker can't be had or stops
 * answering (Safari won't start one from a blob in some frames), they are made on the page itself, one per moment
 * between frames, up to a size that doesn't stutter. Without a page at all (tests) there are none, and objects are
 * drawn in full or as a box.
 */
import type { Mesh } from "@/lib/mesh/mesh";
import { cloneMesh } from "@/lib/mesh/mesh";
import { simplify } from "./simplify";

declare const __LOD_WORKER__: string | undefined;

/** keep about this share of the triangles */
export const SIMPLE_RATIO = 0.35;
/** a worker that hasn't answered in this long isn't going to */
const WORKER_TIMEOUT_MS = 15_000;
/** on the page, meshes bigger than this would stutter a frame: they stay in full */
const MAX_ON_PAGE_TRIS = 30_000;

type Done = (mesh: Mesh | null) => void;
interface Job {
  id: string;
  key: string;
  mesh: Mesh;
  done: Done;
}

function startWorker(): Worker | null {
  if (typeof __LOD_WORKER__ !== "string" || typeof Worker === "undefined") return null;
  try {
    return new Worker(URL.createObjectURL(new Blob([__LOD_WORKER__], { type: "text/javascript" })));
  } catch {
    return null;
  }
}

export class Simplifier {
  private worker: Worker | null = startWorker();
  private readonly onPage = typeof window !== "undefined";
  private queue: Job[] = [];
  private busy: Job | null = null;
  private watchdog: ReturnType<typeof setTimeout> | undefined;

  constructor() {
    if (!this.worker) return;
    this.worker.onmessage = (e) => this.finished(e.data as { key: string; mesh: Mesh | null });
    this.worker.onerror = () => this.withoutWorker();
  }

  get available(): boolean {
    return this.worker !== null || this.onPage;
  }

  /** ask for a simpler version; `done` gets it (or null) later */
  request(id: string, key: string, mesh: Mesh, done: Done): void {
    if (!this.available || this.queue.some((j) => j.key === key) || this.busy?.key === key) return;
    // a newer mesh of the same object replaces the one still waiting
    this.queue = this.queue.filter((j) => j.id !== id);
    this.queue.push({ id, key, mesh: cloneMesh(mesh), done });
    this.next();
  }

  private next(): void {
    if (this.busy) return;
    const job = this.queue.shift();
    if (!job) return;
    this.busy = job;
    if (this.worker) {
      this.worker.postMessage({ key: job.key, mesh: job.mesh, ratio: SIMPLE_RATIO });
      this.watchdog = setTimeout(() => this.withoutWorker(), WORKER_TIMEOUT_MS);
    } else {
      setTimeout(() => this.onThePage(job), 0);
    }
  }

  private onThePage(job: Job): void {
    const small = job.mesh.f.length <= MAX_ON_PAGE_TRIS;
    this.finished({ key: job.key, mesh: small ? simplify(job.mesh, SIMPLE_RATIO) : null });
  }

  /** the worker failed or went quiet: from now on the page does it, starting with the job it had */
  private withoutWorker(): void {
    clearTimeout(this.watchdog);
    this.worker?.terminate();
    this.worker = null;
    const job = this.busy;
    this.busy = null;
    if (job) this.queue.unshift(job);
    this.next();
  }

  private finished(r: { key: string; mesh: Mesh | null }): void {
    clearTimeout(this.watchdog);
    const job = this.busy;
    this.busy = null;
    if (job && job.key === r.key) job.done(r.mesh);
    this.next();
  }
}
