import { describe, expect, it } from "vitest";
import type { Vec3 } from "../../vec";
import { genBox, genCylinder, genPlane, genSphere } from "../generators";
import { flatRegion, sharpEdges } from "../select-similar";
import { expectSane, topFaces } from "../test-helpers";
import { topologyOf } from "../topology";
import { inspect } from "../validate";
import { insertVertexOnEdge } from "./connect";
import { extrudeEdges } from "./extrude";
import { spikeVertex } from "./spike";
import { splitFaces } from "./split-faces";

describe("detach, spike, edges", () => {
  it("splitFaces detaches the region", () => {
    const m = genBox(2);
    splitFaces(m, new Set(topFaces(m)));
    const r = inspect(m);
    expect(r.nonManifold.length).toBe(0);
    expect(r.open.length).toBe(16);
    expect(r.parts).toBe(2);
  });
  it("spike from a cube corner", () => {
    const m = genBox(1);
    const v = m.v.findIndex((p) => p[0] > 0 && p[1] > 0 && p[2] > 0);
    const f0 = m.f.length;
    const { tip } = spikeVertex(m, v, 0.1, [1, 1, 1]);
    expect(m.f.length).toBe(f0 + 3);
    expectSane(m);
    m.v[tip] = [0.8, 0.8, 0.8];
    expectSane(m);
  });
  it("spike on sphere pole and equator", () => {
    for (const pick of [(p: Vec3) => p[2] > 0.49, (p: Vec3) => Math.abs(p[2]) < 0.05]) {
      const m = genSphere(12);
      spikeVertex(m, m.v.findIndex(pick), 0.05, [1, 1, 1]);
      expectSane(m);
    }
  });
  it("insert vertex on an edge", () => {
    const m = genBox(1);
    const k = [...topologyOf(m).edges.keys()][0];
    const e0 = topologyOf(m).edges.size;
    insertVertexOnEdge(m, k, 0.3);
    expectSane(m);
    expect(topologyOf(m).edges.size).toBe(e0 + 1);
    expect(m.f.length).toBe(6);
  });
  it("extrude open edges", () => {
    const m = genPlane(1);
    const b = [...topologyOf(m).edges.keys()];
    const one = extrudeEdges(m, new Set([b[0]]));
    expect(one.edges.size).toBe(1);
    expect(m.f.length).toBe(2);
    expectSane(m, false);
    const p = genPlane(1);
    extrudeEdges(p, new Set(topologyOf(p).edges.keys()));
    expect(p.f.length).toBe(5);
    expectSane(p, false);
    const c = genBox(1);
    expect(() => extrudeEdges(c, new Set([[...topologyOf(c).edges.keys()][0]]))).toThrow();
  });
  it("sharp edges and flat region", () => {
    const m = genBox(2);
    expect(sharpEdges(m, 30, [1, 1, 1]).size).toBe(24);
    expect(flatRegion(m, [topFaces(m)[0]], 5, [1, 1, 1]).size).toBe(4);
    expect(sharpEdges(genCylinder(16, 1), 30, [1, 1, 1]).size).toBe(32);
  });
});
