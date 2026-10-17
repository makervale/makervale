import { afterEach, describe, expect, it, vi } from "vitest";
import { genIcosphere } from "@/lib/mesh/generators";
import type { Mesh } from "@/lib/mesh/mesh";

/** a worker that starts but never says anything: what some browsers give when they don't run it */
class SilentWorker {
  onmessage: unknown = null;
  onerror: (() => void) | null = null;
  posted = 0;
  static last: SilentWorker | null = null;
  constructor() {
    SilentWorker.last = this;
  }
  postMessage() {
    this.posted++;
  }
  terminate() {}
}

const g = globalThis as Record<string, unknown>;

async function simplifierWith(globals: Record<string, unknown>) {
  Object.assign(g, globals);
  vi.resetModules();
  const { Simplifier } = await import("./simplifier");
  return new Simplifier();
}

afterEach(() => {
  for (const k of ["window", "Worker", "__LOD_WORKER__"]) delete g[k];
  vi.useRealTimers();
});

describe("simpler meshes", () => {
  it("are made on the page when there is no worker", async () => {
    vi.useFakeTimers();
    const s = await simplifierWith({ window: {} });
    expect(s.available).toBe(true);
    let got: Mesh | null | undefined;
    const mesh = genIcosphere(3);
    s.request("o1", "k1", mesh, (m) => (got = m));
    vi.advanceTimersByTime(1);
    expect(got).not.toBeUndefined();
    expect(got!.f.length).toBeLessThan(mesh.f.length);
  });

  it("are made on the page once the worker fails, starting with the job it had", async () => {
    vi.useFakeTimers();
    const s = await simplifierWith({ window: {}, Worker: SilentWorker, __LOD_WORKER__: "" });
    let got: Mesh | null | undefined;
    s.request("o1", "k1", genIcosphere(3), (m) => (got = m));
    expect(SilentWorker.last!.posted).toBe(1);
    SilentWorker.last!.onerror!();
    vi.advanceTimersByTime(1);
    expect(got).toBeTruthy();
  });

  it("are made on the page when the worker never answers", async () => {
    vi.useFakeTimers();
    const s = await simplifierWith({ window: {}, Worker: SilentWorker, __LOD_WORKER__: "" });
    let got: Mesh | null | undefined;
    s.request("o1", "k1", genIcosphere(3), (m) => (got = m));
    vi.advanceTimersByTime(14_000);
    expect(got).toBeUndefined();
    vi.advanceTimersByTime(2_000);
    expect(got).toBeTruthy();
  });
});
