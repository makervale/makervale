import { describe, expect, it } from "vitest";
import type { Quat, Vec3 } from "@/lib/vec";
import { cellBox, cellCount, spread } from "./cells";
import { Ledger } from "./ledger";
import { ROOM_CEILING, SAND_LIMIT } from "./sand";
import type { Shape } from "./weigh";
import { weightOf, worldBox } from "./weigh";

const Q: Quat = [0, 0, 0, 1];

/** a shape of about `w` weight: a fan of triangles in a unit box */
function heavy(w: number, pos: Vec3, size: Vec3 = [1, 1, 1]): Shape {
  const n = Math.max(1, Math.round(w / 1.5));
  const v: Vec3[] = [
    [-0.5, -0.5, -0.5],
    [0.5, 0.5, 0.5],
  ];
  const f: number[][] = [];
  for (let i = 0; i < n; i++) {
    v.push([(i % 97) / 97 - 0.5, 0, 0]);
    f.push([0, 1, v.length - 1]);
  }
  return { pos, quat: Q, size, mesh: { v, f } };
}

describe("weight", () => {
  it("counts triangles and vertices", () => {
    const quad: Shape = {
      pos: [0, 0, 0],
      quat: Q,
      size: [1, 1, 1],
      mesh: {
        v: [
          [0, 0, 0],
          [1, 0, 0],
          [1, 1, 0],
          [0, 1, 0],
        ],
        f: [[0, 1, 2, 3]],
      },
    };
    expect(weightOf(quad)).toBe(2 + 2);
  });

  it("boxes a turned object in the world", () => {
    const s = heavy(10, [10, 0, 0], [2, 2, 2]);
    s.quat = [0, 0, Math.SQRT1_2, Math.SQRT1_2];
    const b = worldBox(s);
    expect(b.lo[0]).toBeCloseTo(9);
    expect(b.hi[0]).toBeCloseTo(11);
  });

  it("spreads all of the weight, the same way every time", () => {
    const c = cellBox({ lo: [0, 0, 0], hi: [10, 3, 10] });
    const s = spread(1001, c);
    expect(s.amounts.reduce((a, b) => a + b, 0)).toBe(1001);
    expect(spread(1001, c)).toEqual(s);
    expect(s.keys.length).toBe(cellCount(c));
  });
});

describe("the sand ledger", () => {
  it("lets a heavy thing stand alone, not ten of them in one corner", () => {
    const L = new Ledger();
    const one = SAND_LIMIT / 4;
    let ok = 0;
    for (let i = 0; i < 10; i++) {
      const p = L.propose([["b" + i, heavy(one, [1, 1, 1])]]);
      if (!L.verdict(p).ok) break;
      L.commit(p);
      ok++;
    }
    expect(ok).toBeGreaterThanOrEqual(3);
    expect(ok).toBeLessThan(10);
  });

  it("…but the same things spread out all fit", () => {
    const L = new Ledger();
    const one = SAND_LIMIT / 4;
    for (let i = 0; i < 10; i++) {
      const p = L.propose([["b" + i, heavy(one, [i * 40, 1, 0])]]);
      expect(L.verdict(p).ok).toBe(true);
      L.commit(p);
    }
  });

  it("stops a move into a full place, allows moving away", () => {
    const L = new Ledger();
    const big = SAND_LIMIT * 0.6;
    L.reset([
      ["a", heavy(big, [0, 0, 0])],
      ["b", heavy(big, [100, 0, 0])],
    ]);
    expect(L.verdict(L.propose([["b", heavy(big, [2, 0, 0])]])).ok).toBe(false);
    expect(L.verdict(L.propose([["b", heavy(big, [200, 0, 0])]])).ok).toBe(true);
  });

  it("keeps a room under its ceiling", () => {
    const L = new Ledger();
    const one = SAND_LIMIT / 2;
    let i = 0;
    for (; i < ROOM_CEILING; i++) {
      const p = L.propose([["o" + i, heavy(one, [i * 60, 0, 0])]]);
      const v = L.verdict(p);
      if (!v.ok) {
        expect(v.why).toBe("full");
        break;
      }
      L.commit(p);
    }
    expect(L.total).toBeLessThanOrEqual(ROOM_CEILING);
    expect(i).toBeGreaterThan(10);
  });

  it("a scene already over the limit loads, and may only lose sand there", () => {
    const L = new Ledger();
    const big = SAND_LIMIT * 0.8;
    L.reset([
      ["a", heavy(big, [0, 0, 0])],
      ["b", heavy(big, [1, 0, 0])],
    ]);
    expect(L.fullest()).toBeGreaterThan(1);
    expect(L.verdict(L.propose([["c", heavy(100, [0, 0, 0])]])).ok).toBe(false);
    expect(L.verdict(L.propose([["b", null]])).ok).toBe(true);
  });

  it("a huge plain object lies thin", () => {
    const L = new Ledger();
    const terrain = heavy(20_000, [0, 0, 0], [600, 4, 600]);
    expect(L.verdict(L.propose([["t", terrain]])).ok).toBe(true);
  });
});
