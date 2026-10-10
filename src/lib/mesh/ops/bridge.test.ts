import { describe, expect, it } from "vitest";
import { genBox, genCylinder } from "../generators";
import type { Mesh } from "../mesh";
import { faceNormal, signedVolume } from "../mesh";
import { expectSane, moved } from "../test-helpers";
import { topologyOf } from "../topology";
import { append } from "./append";
import { bridge } from "./bridge";
import { deleteFaces } from "./delete";

/** the face of the first part facing +axis and the face of the second part facing −axis */
function facingFaces(m: Mesh, axis: number): [number, number] {
  const a = m.f.findIndex((p) => faceNormal(m, p)[axis] > 0.9 && p.every((i) => m.v[i][axis] < 1));
  const b = m.f.findIndex((p) => faceNormal(m, p)[axis] < -0.9 && p.every((i) => m.v[i][axis] > 1));
  return [a, b];
}

describe("bridge", () => {
  it("joins two boxes through one face each", () => {
    const m = genBox(1);
    append(m, moved(genBox(1), [2, 0, 0]));
    const [a, b] = facingFaces(m, 0);
    const s = bridge(m, new Set(), new Set([a, b]), 0);
    expect(s.faces.size).toBe(4);
    const r = expectSane(m);
    expect(r.parts).toBe(1);
    expect(signedVolume(m)).toBeCloseTo(3, 5);
  });
  it("bridges two open loops with cuts", () => {
    const m = genBox(1);
    append(m, moved(genBox(1), [0, 0, 2]));
    const [a, b] = facingFaces(m, 2);
    deleteFaces(m, new Set([a, b]));
    const keys = [...topologyOf(m).edges].filter(([, e]) => e.faces.length === 1).map(([k]) => k);
    bridge(m, new Set(keys), new Set(), 2);
    expectSane(m);
    expect(signedVolume(m)).toBeCloseTo(3, 5);
  });
  it("refuses loops of different size", () => {
    const m = genBox(1);
    append(m, moved(genCylinder(6), [0, 0, 2]));
    const [a, b] = facingFaces(m, 2);
    expect(() => bridge(m, new Set(), new Set([a, b]))).toThrow(/same number/);
  });
});
