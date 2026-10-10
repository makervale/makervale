import { describe, expect, it } from "vitest";
import * as THREE from "three";
import { genBox } from "@/lib/mesh/generators";
import { emptySelection } from "@/lib/mesh/selection";
import { emptyWorld, newObj } from "@/world/model";
import { applyToVerts, falloff, mirrorTwins, softWeights } from "./soft";

describe("soft selection", () => {
  it("falls off smoothly to zero at the radius", () => {
    expect(falloff(0, 1)).toBe(1);
    expect(falloff(0.5, 1)).toBeCloseTo(0.5625);
    expect(falloff(1, 1)).toBe(0);
  });
  it("pairs vertices across X = 0", () => {
    const twins = mirrorTwins([
      [-1, 0, 0],
      [1, 0, 0],
      [0, 1, 0],
    ]);
    expect(twins.get(0)).toBe(1);
    expect(twins.get(1)).toBe(0);
    expect(twins.has(2)).toBe(false);
  });
  it("moves selected vertices and their mirror twins", () => {
    const o = newObj(emptyWorld(), genBox(), [0, 0, 0], [1, 1, 1]);
    const sel = emptySelection();
    const i = o.mesh.v.findIndex((p) => p[0] > 0 && p[1] > 0 && p[2] > 0);
    sel.verts.add(i);
    const M = new THREE.Matrix4();
    const start = o.mesh.v.map((p) => [...p] as [number, number, number]);
    const soft = softWeights(o, M, sel, 0, true);
    applyToVerts(o, M, start, soft, (p) => p.add(new THREE.Vector3(0, 0, 1)));
    const twin = soft.mirror!.get(i)!;
    expect(o.mesh.v[i][2]).toBeCloseTo(start[i][2] + 1);
    expect(o.mesh.v[twin]).toEqual([-o.mesh.v[i][0], o.mesh.v[i][1], o.mesh.v[i][2]]);
  });
});
