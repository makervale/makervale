import { describe, expect, it } from "vitest";
import { genBox, genCylinder, genPlane, genSphere } from "../generators";
import type { Mesh } from "../mesh";
import { cloneMesh, edgeKey, signedVolume } from "../mesh";
import { HEALTHY, defects, firstVerticalEdge } from "../test-helpers";
import { topologyOf } from "../topology";
import { triangulatePoly } from "../triangulate";
import { inspect } from "../validate";
import { append } from "./append";
import { connectVerts, dissolveEdges } from "./connect";
import { deleteFaces, extract } from "./delete";
import { extrude, regionNormal } from "./extrude";
import { fill } from "./fill";
import { inset } from "./inset";
import { loopCut } from "./loop-cut";
import { mergeAtCenter, weld } from "./merge";
import { mirrorX } from "./mirror";
import { flip, recalcNormals } from "./normals";
import { subdivide } from "./subdivide";
import { triangulate } from "./triangulate";
import { trisToQuads } from "./tris-to-quads";

const allFaces = (m: Mesh): Set<number> => new Set(m.f.map((_, i) => i));

describe("operations keep solids closed", () => {
  it("extrude one face (zero-length walls until moved)", () => {
    const m = genBox(1);
    const s = extrude(m, new Set([4]));
    expect(s.faces.has(4)).toBe(true);
    expect({ ...defects(m), degenerate: 0 }).toEqual(HEALTHY);
    expect(inspect(m).degenerate.length).toBe(4);
    expect(m.f.length).toBe(10);
  });
  it("extrude two adjacent faces as one region", () => {
    const m = genBox(2);
    const e = [...topologyOf(m).edges.values()].find((e) => e.faces.length === 2)!;
    const n = regionNormal(m, e.faces);
    extrude(m, new Set(e.faces));
    const vs = new Set(e.faces.flatMap((f) => m.f[f]));
    for (const v of vs) for (let k = 0; k < 3; k++) m.v[v][k] += n[k] * 0.3;
    expect(defects(m)).toEqual(HEALTHY);
  });
  it("extrude then move outward grows volume", () => {
    const m = genBox(1);
    extrude(m, new Set([4]));
    for (const v of new Set(m.f[4])) m.v[v][2] += 0.5;
    expect(signedVolume(m)).toBeCloseTo(1.5, 6);
    expect(defects(m)).toEqual(HEALTHY);
  });
  it("extrude an open plane makes walls", () => {
    const m = genPlane(1);
    extrude(m, new Set([0]));
    expect(m.f.length).toBe(5);
    expect(inspect(m).flipped.length).toBe(0);
  });
  it("inset", () => {
    const m = genBox(1);
    inset(m, new Set([0, 4]), 0.3);
    expect(m.f.length).toBe(14);
    expect(defects(m)).toEqual(HEALTHY);
    expect(signedVolume(m)).toBeCloseTo(1, 6);
  });
  it("inset with depth makes a dent", () => {
    const m = genBox(1);
    inset(m, new Set([4]), 0.3, -0.2);
    expect(defects(m)).toEqual(HEALTHY);
    expect(signedVolume(m)).toBeLessThan(1);
  });
  it("loop cut, one and three cuts", () => {
    for (const n of [1, 3]) {
      const m = genBox(1);
      const s = loopCut(m, firstVerticalEdge(m), n);
      expect(s.edges.size).toBe(4 * n);
      expect(defects(m)).toEqual(HEALTHY);
      expect(m.f.length).toBe(2 + 4 * (n + 1));
    }
  });
  it("loop cut through a cylinder splices the caps", () => {
    const m = genCylinder(8);
    loopCut(m, firstVerticalEdge(m), 2);
    expect(defects(m)).toEqual(HEALTHY);
    expect(signedVolume(m)).toBeGreaterThan(0.7);
  });
  it("subdivide", () => {
    const m = genBox(1);
    subdivide(m);
    expect(m.f.length).toBe(24);
    expect(defects(m)).toEqual(HEALTHY);
    expect(signedVolume(m)).toBeLessThan(1);
  });
  it("subdivide an open plane keeps the border straight", () => {
    const m = genPlane(1);
    subdivide(m);
    expect(m.f.length).toBe(4);
    expect(inspect(m).flipped.length).toBe(0);
  });
  it("delete a face then fill it back", () => {
    const m = genBox(1);
    const p = m.f[4].slice();
    deleteFaces(m, new Set([4]));
    expect(inspect(m).open.length).toBe(4);
    const fi = fill(m, new Set(p), 0);
    expect(fi).not.toBe(false);
    expect(defects(m)).toEqual(HEALTHY);
    expect(signedVolume(m)).toBeCloseTo(1, 6);
  });
  it("mirror X of a half box", () => {
    const m = genBox(1);
    for (const v of m.v) if (v[0] < 0) v[0] = 0; // squash the left half onto the plane
    weld(m, 1e-6);
    const del = new Set<number>();
    m.f.forEach((p, i) => {
      if (p.every((v) => Math.abs(m.v[v][0]) < 1e-9)) del.add(i);
    });
    deleteFaces(m, del);
    mirrorX(m);
    expect(defects(m)).toEqual(HEALTHY);
    expect(signedVolume(m)).toBeCloseTo(1, 6);
  });
  it("weld merges coincident vertices", () => {
    const m = genBox(1);
    append(m, cloneMesh(m));
    expect(weld(m, 1e-5)).toBe(8);
  });
  it("flip then recalc restores outward normals", () => {
    const m = genSphere(12);
    flip(m, new Set([0, 1, 2, 5, 9]));
    expect(inspect(m).flipped.length).toBeGreaterThan(0);
    recalcNormals(m);
    expect(defects(m)).toEqual(HEALTHY);
    expect(signedVolume(m)).toBeGreaterThan(0);
  });
  it("connect vertices splits a face", () => {
    const m = genBox(1);
    const p = m.f[4];
    connectVerts(m, new Set([p[0], p[2]]));
    expect(m.f.length).toBe(7);
    expect(defects(m)).toEqual(HEALTHY);
  });
  it("dissolve the new edge again", () => {
    const m = genBox(1);
    const p = m.f[4];
    connectVerts(m, new Set([p[0], p[2]]));
    dissolveEdges(m, new Set([edgeKey(p[0], p[2])]));
    expect(m.f.length).toBe(6);
    expect(defects(m)).toEqual(HEALTHY);
  });
  it("triangulate and back to quads", () => {
    const m = genBox(1);
    triangulate(m, allFaces(m), triangulatePoly);
    expect(m.f.length).toBe(12);
    expect(defects(m)).toEqual(HEALTHY);
    trisToQuads(m, allFaces(m));
    expect(m.f.length).toBe(6);
    expect(defects(m)).toEqual(HEALTHY);
  });
  it("extract faces into a new mesh", () => {
    const m = genBox(1);
    const part = extract(m, new Set([4]));
    expect(part.f.length).toBe(1);
    expect(m.f.length).toBe(5);
    expect(inspect(m).open.length).toBe(4);
  });
  it("merge at center collapses a face", () => {
    const m = genBox(1);
    const s = mergeAtCenter(m, new Set(m.f[4]));
    expect(s.verts.size).toBe(1);
    expect(defects(m)).toEqual(HEALTHY);
    expect(m.v.length).toBe(5);
  });
});
