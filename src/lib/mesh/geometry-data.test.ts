import { describe, expect, it } from "vitest";
import { buildGeometryData } from "./geometry-data";
import { genBox, genPlane, genSphere } from "./generators";
import { boxUV } from "./uv";

describe("buildGeometryData", () => {
  it("gives every polygon its own vertex block and one group per slot", () => {
    const m = genBox(1);
    m.fm[0] = 1;
    const d = buildGeometryData(m, 40, [1, 1, 1]);
    expect(d.position.length).toBe(24 * 3);
    expect(d.index.length).toBe(12 * 3);
    expect(d.groups).toEqual([
      { start: 0, count: 30, materialIndex: 0 },
      { start: 30, count: 6, materialIndex: 1 },
    ]);
    expect(d.info.slots).toBe(2);
    expect(d.info.open).toBe(false);
    expect(d.info.vertPoly.length).toBe(24);
    // slot 1 is drawn last: its triangles belong to face 0
    expect([...d.info.triPoly.slice(10)]).toEqual([0, 0]);
  });
  it("keeps cube corners hard and sphere normals smooth", () => {
    const box = buildGeometryData(genBox(1), 40, [1, 1, 1]);
    for (let i = 0; i < box.normal.length; i += 3) {
      expect(Math.max(...[0, 1, 2].map((k) => Math.abs(box.normal[i + k])))).toBeCloseTo(1, 6);
    }
    const sphere = genSphere(24);
    const d = buildGeometryData(sphere, 40, [1, 1, 1]);
    // a smoothed normal points away from the centre like the position does
    for (let i = 0; i < d.normal.length; i += 3) {
      const p = [d.position[i], d.position[i + 1], d.position[i + 2]];
      const l = Math.hypot(p[0], p[1], p[2]);
      const along = (p[0] * d.normal[i] + p[1] * d.normal[i + 1] + p[2] * d.normal[i + 2]) / l;
      expect(along).toBeGreaterThan(0.95);
    }
  });
  it("uses stored UVs, otherwise box projection in metres", () => {
    const m = genPlane(1);
    const projected = buildGeometryData(m, 40, [2, 3, 1]);
    expect([...projected.uv.slice(0, 2)]).toEqual([-1, -1.5]);
    expect(projected.info.open).toBe(true);
    boxUV(m, [1, 1, 1]);
    m.uv![0][0] = [7, 8];
    expect([...buildGeometryData(m, 40, [2, 3, 1]).uv.slice(0, 2)]).toEqual([7, 8]);
  });
});
