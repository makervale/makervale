import { describe, expect, it } from "vitest";
import type { Quat, Vec3 } from "@/lib/vec";
import { Ledger } from "./ledger";
import type { Field } from "./shells";
import { fieldsOf, isoSurface } from "./shells";

/** a ball of radius 3 samples: 1 at the centre, falling off linearly */
function ball(): Field {
  const n = 11;
  const at = new Float32Array(n * n * n);
  for (let k = 0; k < n; k++)
    for (let j = 0; j < n; j++)
      for (let i = 0; i < n; i++) at[k * n * n + j * n + i] = Math.max(0, 1 - Math.hypot(i - 5, j - 5, k - 5) / 6);
  return { lo: [0, 0, 0], step: 1, dims: [n, n, n], at };
}

describe("isoSurface", () => {
  it("wraps a ball in a closed shell at the level, facing out", () => {
    const s = isoSurface(ball(), 0.5);
    expect(s.indices.length).toBeGreaterThan(0);
    const p = (v: number) => [s.positions[v * 3] - 5, s.positions[v * 3 + 1] - 5, s.positions[v * 3 + 2] - 5];
    for (let v = 0; v < s.positions.length / 3; v++) expect(Math.hypot(...p(v))).toBeCloseTo(3, 0);
    let volume = 0;
    for (let t = 0; t < s.indices.length; t += 3) {
      const [a, b, c] = [p(s.indices[t]), p(s.indices[t + 1]), p(s.indices[t + 2])];
      volume +=
        (a[0] * (b[1] * c[2] - b[2] * c[1]) - a[1] * (b[0] * c[2] - b[2] * c[0]) + a[2] * (b[0] * c[1] - b[1] * c[0])) /
        6;
    }
    expect(volume).toBeGreaterThan(0.8 * ((4 / 3) * Math.PI * 27));
    const edges = new Map<string, number>();
    for (let t = 0; t < s.indices.length; t += 3)
      for (let e = 0; e < 3; e++) {
        const [a, b] = [s.indices[t + e], s.indices[t + ((e + 1) % 3)]];
        const k = Math.min(a, b) + ":" + Math.max(a, b);
        edges.set(k, (edges.get(k) ?? 0) + 1);
      }
    expect([...edges.values()].every((n) => n === 2)).toBe(true);
  });

  it("finds nothing where the field never reaches the level", () => {
    expect(isoSurface(ball(), 1.5).indices).toEqual([]);
  });
});

describe("fieldsOf", () => {
  it("gives places far apart fields of their own, never one grid between them", () => {
    const ledger = new Ledger();
    const heavy = (x: number, y: number) => {
      const v: [number, number, number][] = [
        [0, 0, 0],
        [1, 0, 0],
      ];
      const f: number[][] = [];
      for (let i = 0; i < 20_000; i++) {
        v.push([i / 20_000, 1, 0]);
        f.push([0, 1, v.length - 1]);
      }
      return { pos: [x, y, 0] as Vec3, quat: [0, 0, 0, 1] as Quat, size: [1, 1, 1] as Vec3, mesh: { v, f } };
    };
    ledger.reset([
      ["a", heavy(0, 0)],
      ["b", heavy(100_000, 100_000)],
    ]);
    const fields = fieldsOf(ledger, 0.3);
    expect(fields).toHaveLength(2);
    for (const f of fields) expect(f.at.length).toBeLessThan(100_000);
  });
});
